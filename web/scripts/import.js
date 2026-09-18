import fs from 'fs';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// IMPORTANT: Use your SERVICE_ROLE key here to bypass Row Level Security (RLS) during imports
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY 
);

const results = [];

fs.createReadStream('trucks.csv')
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', async () => {
    console.log(`Parsed ${results.length} rows. Starting import...`);

    for (const row of results) {
      const { category_name, brand_name, model_name, slug, year_start, ...rawSpecs } = row;

      // 1. Get or Create Category
      let { data: category } = await supabase.from('categories').select('id').eq('name', category_name).single();
      if (!category) {
        const res = await supabase.from('categories').insert({ name: category_name, slug: category_name.toLowerCase().replace(/ /g, '-') }).select().single();
        category = res.data;
      }

      // 2. Get or Create Brand
      let { data: brand } = await supabase.from('brands').select('id').eq('name', brand_name).single();
      if (!brand) {
        const res = await supabase.from('brands').insert({ name: brand_name, slug: brand_name.toLowerCase().replace(/ /g, '-') }).select().single();
        brand = res.data;
      }

      // 3. Clean up the specs (remove empty CSV columns)
      const cleanSpecs = Object.fromEntries(
        Object.entries(rawSpecs).filter(([_, v]) => v != null && v !== '')
      );

      // 4. Insert the Entity (Equipment)
      const { error } = await supabase.from('entities').upsert({
        category_id: category.id,
        brand_id: brand.id,
        model_name: model_name,
        slug: slug,
        year_start: parseInt(year_start),
        specs: cleanSpecs // Automatically inserts as JSONB!
      }, { onConflict: 'slug' });

      if (error) console.error(`Error importing ${slug}:`, error.message);
      else console.log(`Successfully imported: ${slug}`);
    }
    
    console.log('Bulk import complete!');
  });