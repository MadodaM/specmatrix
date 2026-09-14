import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials in environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Define strict validation schema using Zod
const specRecordSchema = z.object({
    category: z.object({
        name: z.string().min(1, "Category name is required"),
        slug: z.string().min(1, "Category slug is required")
    }),
    brand: z.object({
        name: z.string().min(1, "Brand name is required"),
        slug: z.string().min(1, "Brand slug is required")
    }),
    model: z.string().min(1, "Model name is required"),
    slug: z.string().min(1, "Entity slug is required"),
    years: z.object({
        start: z.number().int().min(1900).max(2100),
        end: z.number().int().min(1900).max(2100).nullable().optional()
    }),
    specifications: z.record(z.any()).default({}),
    replacement_parts: z.array(
        z.object({
            name: z.string().min(1),
            part_no: z.string().optional(),
            url: z.string().optional()
        })
    ).optional()
});

async function processJsonFeed() {
    const filePath = path.resolve('data/raw-specs.json');
    
    if (!fs.existsSync(filePath)) {
        console.error(`Data file not found at: ${filePath}`);
        process.exit(1);
    }

    // Read and parse the JSON payload
    const rawData = fs.readFileSync(filePath, 'utf-8');
    let items;
    try {
        items = JSON.parse(rawData);
    } catch (err) {
        console.error("Failed to parse raw-specs.json as valid JSON:", err.message);
        process.exit(1);
    }

    console.log(`Loaded ${items.length} records from raw feed. Validating and processing...`);

    let successCount = 0;
    let failureCount = 0;

    for (const [index, rawItem] of items.entries()) {
        // Validate record using Zod
        const validationResult = specRecordSchema.safeParse(rawItem);
        
        if (!validationResult.success) {
            failureCount++;
            console.error(`[ValidationError] Record at index ${index} (${rawItem?.slug || 'unknown-slug'}) failed validation:`);
            console.error(JSON.stringify(validationResult.error.format(), null, 2));
            continue; // Skip malformed record, maintain database integrity
        }

        const item = validationResult.data;

        // 1. Upsert Category
        const { data: catData, error: catErr } = await supabase
            .from('categories')
            .upsert({ name: item.category.name, slug: item.category.slug }, { onConflict: 'slug' })
            .select('id')
            .single();

        if (catErr) {
            console.error(`Category error (${item.category.slug}):`, catErr.message);
            failureCount++;
            continue;
        }

        // 2. Upsert Brand
        const { data: brandData, error: brandErr } = await supabase
            .from('brands')
            .upsert({ name: item.brand.name, slug: item.brand.slug }, { onConflict: 'slug' })
            .select('id')
            .single();

        if (brandErr) {
            console.error(`Brand error (${item.brand.slug}):`, brandErr.message);
            failureCount++;
            continue;
        }

        // 3. Upsert Master Entity
        const entityPayload = {
            category_id: catData.id,
            brand_id: brandData.id,
            model_name: item.model,
            year_start: item.years.start,
            year_end: item.years.end || null,
            slug: item.slug,
            specs: item.specifications
        };

        const { data: entityData, error: entityErr } = await supabase
            .from('entities')
            .upsert(entityPayload, { onConflict: 'slug' })
            .select('id')
            .single();

        if (entityErr) {
            console.error(`Entity error (${item.slug}):`, entityErr.message);
            failureCount++;
            continue;
        }

        // 4. Sync Compatible Parts (Clear & Replace pattern)
        await supabase.from('compatible_parts').delete().eq('entity_id', entityData.id);

        if (item.replacement_parts && item.replacement_parts.length > 0) {
            const partsPayload = item.replacement_parts.map(part => ({
                entity_id: entityData.id,
                part_name: part.name,
                part_number: part.part_no || null,
                affiliate_url: part.url || null
            }));

            const { error: partErr } = await supabase
                .from('compatible_parts')
                .insert(partsPayload);

            if (partErr) {
                console.error(`Parts error for ${item.slug}:`, partErr.message);
            }
        }

        successCount++;
        console.log(`[Success] Ingested and validated payload for: ${item.slug}`);
    }

    console.log(`\nIngestion pipeline completed.`);
    console.log(`Successfully processed: ${successCount} records`);
    console.log(`Rejected/Failed: ${failureCount} records`);
}

processJsonFeed();