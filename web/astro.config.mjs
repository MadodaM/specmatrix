import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://specmatrix.io',
  integrations: [
    tailwind(),
    sitemap({
      filter: (page) => !page.includes('/go/')
    })
  ]
});