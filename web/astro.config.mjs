import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://specmatrix.io',
  integrations: [
    tailwind(),
    sitemap({
      // This tells Astro to drop any URL containing '/go/' from the XML sitemaps
      filter: (page) => !page.includes('/go/')
    })
  ]
});