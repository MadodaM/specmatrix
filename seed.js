import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase URL or Service Role Key in environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Bulk dataset spanning multiple industrial, automotive, and heavy machinery niches
const bulkItems = [
    {
        category_slug: "commercial-vehicles",
        category_name: "Commercial & Fleet Trucks",
        brand_name: "Volvo",
        brand_slug: "volvo",
        model_name: "FH16 750 Globetrotter",
        year_start: 2022,
        year_end: 2026,
        slug: "volvo-fh16-750-globetrotter-2022",
        specs: {
            fuel_type: "Diesel",
            engine_displacement: "16.1L",
            horsepower: "750 hp",
            torque: "3550 Nm",
            transmission: "I-Shift Dual Clutch",
            gross_combination_weight: "100,000 kg"
        },
        parts: [
            { part_name: "Heavy-Duty Fuel Filter", part_number: "VOL-21380488", affiliate_url: "https://example.com/affiliate/volvo-fuel-filter" },
            { part_name: "Synthetic Engine Oil 15W-40", part_number: "VDS-4.5-20L", affiliate_url: "https://example.com/affiliate/volvo-oil" }
        ]
    },
    {
        category_slug: "heavy-machinery",
        category_name: "Construction & Earthmoving",
        brand_name: "Caterpillar",
        brand_slug: "caterpillar",
        model_name: "D8 Bulldozer",
        year_start: 2020,
        year_end: 2026,
        slug: "caterpillar-d8-bulldozer-2020",
        specs: {
            fuel_type: "Diesel",
            engine_displacement: "15.2L Cat C15",
            operating_weight: "38,215 kg",
            net_power: "354 hp",
            blade_capacity: "8.7 m³"
        },
        parts: [
            { part_name: "Hydraulic Filter Element", part_number: "CAT-1P-2297", affiliate_url: "https://example.com/affiliate/cat-hydraulic-filter" }
        ]
    },
    {
        category_slug: "power-tools",
        category_name: "Industrial Power Tools",
        brand_name: "Bosch Professional",
        brand_slug: "bosch-professional",
        model_name: "GSB 18V-150 C Drill",
        year_start: 2023,
        year_end: 2026,
        slug: "bosch-gsb-18v-150c-drill-2023",
        specs: {
            power_source: "18V Li-Ion Battery",
            max_torque_hard: "150 Nm",
            no_load_speed: "2,200 rpm",
            chuck_capacity: "1.5 - 13 mm",
            weight_without_battery: "2.1 kg"
        },
        parts: [
            { part_name: "ProCore 18V 8.0Ah Battery", part_number: "1600A161G3", affiliate_url: "https://example.com/affiliate/bosch-battery" }
        ]
    }
];

async function runBulkIngestion() {
    console.log(`Starting bulk ingestion for ${bulkItems.length} records...`);

    for (const item of bulkItems) {
        // 1. Upsert Category
        const { data: categoryData, error: catError } = await supabase
            .from('categories')
            .upsert({ name: item.category_name, slug: item.category_slug }, { onConflict: 'slug' })
            .select('id')
            .single();
        
        if (catError) {
            console.error(`Error with category ${item.category_slug}:`, catError.message);
            continue;
        }

        // 2. Upsert Brand
        const { data: brandData, error: brandError } = await supabase
            .from('brands')
            .upsert({ name: item.brand_name, slug: item.brand_slug }, { onConflict: 'slug' })
            .select('id')
            .single();

        if (brandError) {
            console.error(`Error with brand ${item.brand_slug}:`, brandError.message);
            continue;
        }

        // 3. Upsert Master Entity
        const entityPayload = {
            category_id: categoryData.id,
            brand_id: brandData.id,
            model_name: item.model_name,
            year_start: item.year_start,
            year_end: item.year_end,
            slug: item.slug,
            specs: item.specs
        };

        const { data: entityData, error: entityError } = await supabase
            .from('entities')
            .upsert(entityPayload, { onConflict: 'slug' })
            .select('id')
            .single();

        if (entityError) {
            console.error(`Error with entity ${item.slug}:`, entityError.message);
            continue;
        }

        // 4. Insert/Update Compatible Parts (Clear existing parts for this entity to prevent duplication on re-runs)
        await supabase.from('compatible_parts').delete().eq('entity_id', entityData.id);

        if (item.parts && item.parts.length > 0) {
            const partsPayload = item.parts.map(part => ({
                entity_id: entityData.id,
                part_name: part.part_name,
                part_number: part.part_number,
                affiliate_url: part.affiliate_url
            }));

            const { error: partError } = await supabase
                .from('compatible_parts')
                .insert(partsPayload);
            
            if (partError) {
                console.error(`Error inserting parts for ${item.slug}:`, partError.message);
            }
        }

        console.log(`Successfully processed: ${item.slug}`);
    }

    console.log("Bulk ingestion pipeline completed successfully.");
}

runBulkIngestion();