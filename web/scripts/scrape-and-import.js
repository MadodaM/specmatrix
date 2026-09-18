import fs from 'fs';
import FirecrawlApp from '@mendable/firecrawl-js';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function ingestEquipmentCatalog(url, targetCategory) {
  console.log(`[1/4] Scraping Catalog: ${url}...`);

  // 1. UPDATED SCHEMA: We now ask for an ARRAY of equipment items
  const schema = {
    type: "object",
    properties: {
      equipment_list: {
        type: "array",
        description: "A list of all the vehicles or equipment found on the page.",
        items: {
          type: "object",
          properties: {
            brand_name: { type: "string", description: "e.g., Sinotruk, Shacman, Volvo" },
            model_name: { type: "string", description: "e.g., HOWO TX7, F3000" },
            year_start: { type: "integer" },
            specs: { type: "object", additionalProperties: { type: "string" } },
            compatible_parts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  part_number: { type: "string" },
                  part_name: { type: "string" },
                  category: { type: "string" }
                }
              }
            }
          },
          required: ["brand_name", "model_name", "specs"]
        }
      }
    },
    required: ["equipment_list"]
  };

  // 2. Extract using Firecrawl
  const scrapeResult = await app.scrapeUrl(url, { 
    formats: [{ type: 'json', schema: schema }] 
  });
  
  const data = scrapeResult.json;
  
  if (!data || !data.equipment_list || data.equipment_list.length === 0) {
      throw new Error("Failed to extract any vehicles matching the schema.");
  }

  console.log(`[2/4] Found ${data.equipment_list.length} vehicles on the page! Processing...`);

  // 3. Loop through EVERY vehicle found on the page
  for (const item of data.equipment_list) {
    const modelSlug = `${item.brand_name}-${item.model_name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    console.log(`\n👉 Upserting: ${item.brand_name} ${item.model_name}...`);

    // Get or Create Category
    let { data: category } = await supabase.from('categories').select('id').eq('name', targetCategory).single();
    if (!category) {
      const res = await supabase.from('categories').insert({ name: targetCategory, slug: targetCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-') }).select().single();
      category = res.data;
    }

    // Get or Create Brand
    let { data: brand } = await supabase.from('brands').select('id').eq('name', item.brand_name).single();
    if (!brand) {
      const res = await supabase.from('brands').insert({ name: item.brand_name, slug: item.brand_name.toLowerCase().replace(/[^a-z0-9]+/g, '-') }).select().single();
      brand = res.data;
    }

    // Upsert Entity
    const { data: entity, error: entityErr } = await supabase.from('entities').upsert({
      category_id: category.id,
      brand_id: brand.id,
      model_name: item.model_name,
      slug: modelSlug,
      year_start: item.year_start || 2024,
      specs: item.specs
    }, { onConflict: 'slug' }).select().single();

    if (entityErr) {
      console.error(`❌ Failed to insert ${modelSlug}:`, entityErr.message);
      continue; // Skip to the next truck if this one fails
    }

    // Upsert Compatible Parts
    if (item.compatible_parts && item.compatible_parts.length > 0) {
      const partsPayload = item.compatible_parts.map(part => ({
        entity_id: entity.id,
        part_number: part.part_number,
        part_name: part.part_name,
        category: part.category
      }));
      await supabase.from('compatible_parts').upsert(partsPayload);
    }

    console.log(`✅ Success: /specs/${brand.slug}/${modelSlug}`);
  }
  
  console.log(`\n🎉 Bulk extraction complete!`);
}

// Helper function to pause execution and prevent API rate limiting
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function processQueue(filePath) {
  // 1. Read file and split into an array of URLs (ignoring empty lines)
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const urls = fileContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  console.log(`Found ${urls.length} URLs in queue. Starting batch process...`);

  let successCount = 0;
  let failCount = 0;

  // 2. Loop through each URL sequentially
  for (const [index, url] of urls.entries()) {
    console.log(`\n===========================================`);
    console.log(`⏳ Processing [${index + 1}/${urls.length}]: ${url}`);
    
    try {
      // Await the function you already built
      await ingestEquipmentCatalog(url, 'Commercial Trucks');
      successCount++;
    } catch (error) {
      // If one URL fails (e.g., page 404s), catch the error and keep going
      console.error(`❌ Failed to process ${url}:`, error.message);
      failCount++;
    }

    // 3. Wait 3 seconds before the next URL to respect Firecrawl limits
    if (index < urls.length - 1) {
      console.log(`Waiting 3 seconds before next request...`);
      await sleep(3000);
    }
  }

  console.log(`\n===========================================`);
  console.log(`🏁 Queue Complete! Success: ${successCount} | Failed: ${failCount}`);
}

// Fire the queue
processQueue('urls.txt');