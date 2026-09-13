import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials in environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function processJsonFeed() {
    const filePath = path.resolve('data/raw-specs.json');
    
    if (!fs.existsSync(filePath)) {
        console.error(`Data file not found at: ${filePath}`);
        process.exit(1);
    }

    // Read and parse the JSON payload
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const items = JSON.parse(rawData);

    console.log(`Loaded ${items.length} records from raw feed. Processing...`);

    for (const item of items) {
        // 1. Upsert Category
        const { data: catData, error: catErr } = await supabase
            .from('categories')
            .upsert({ name: item.category.name, slug: item.category.slug }, { onConflict: 'slug' })
            .select('id')
            .single();

        if (catErr) {
            console.error(`Category error (${item.category.slug}):`, catErr.message);
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
            continue;
        }

        // 3. Upsert Master Entity
        const entityPayload = {
            category_id: catData.id,
            brand_id: brandData.id,
            model_name: item.model,
            year_start: item.years.start,
            year_end: item.years.end,
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
            continue;
        }

        // 4. Sync Compatible Parts (Clear & Replace pattern)
        await supabase.from('compatible_parts').delete().eq('entity_id', entityData.id);

        if (item.replacement_parts && item.replacement_parts.length > 0) {
            const partsPayload = item.replacement_parts.map(part => ({
                entity_id: entityData.id,
                part_name: part.name,
                part_number: part.part_no,
                affiliate_url: part.url
            }));

            const { error: partErr } = await supabase
                .from('compatible_parts')
                .insert(partsPayload);

            if (partErr) {
                console.error(`Parts error for ${item.slug}:`, partErr.message);
            }
        }

        console.log(`[Success] Ingested payload for: ${item.slug}`);
    }

    console.log("JSON feed ingestion pipeline completed.");
}

processJsonFeed();