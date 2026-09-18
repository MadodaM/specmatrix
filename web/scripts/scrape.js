import FirecrawlApp from '@mendable/firecrawl-js';
import 'dotenv/config';

// 1. Initialize the extraction engine
const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

async function scrapeEquipmentSpecs(url) {
  console.log(`Scraping: ${url}...`);

  // 2. Define the exact JSON schema required by your Supabase architecture
  const schema = {
    type: "object",
    properties: {
      brand_name: { type: "string" },
      model_name: { type: "string" },
      year_start: { type: "integer" },
      specs: {
        type: "object",
        description: "The technical specifications (e.g., gross combination mass, axle configuration)",
        additionalProperties: { type: "string" } 
      },
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
    required: ["brand_name", "model_name", "specs", "compatible_parts"]
  };

  // 3. Extract the structured data
  const scrapeResult = await app.scrapeUrl(url, {
    formats: ['extract'],
    extract: { schema: schema }
  });

  if (!scrapeResult.success) {
    throw new Error(`Failed to scrape: ${scrapeResult.error}`);
  }

  console.log("Extraction Complete:", JSON.stringify(scrapeResult.extract.data, null, 2));
  return scrapeResult.extract.data;
}

// Test the scraper
scrapeEquipmentSpecs('https://example.com/target-equipment-page');