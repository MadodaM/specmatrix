import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://specmatrix.io', // Required for sitemap generation
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [sitemap()]
});