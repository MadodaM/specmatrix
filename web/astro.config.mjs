import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://specmatrix.io',
  integrations: [
    // We only pass the sitemap integration with the /go/ filter
    sitemap({
      filter: (page) => !page.includes('/go/')
    })
  ]
});