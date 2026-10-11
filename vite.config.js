import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        ru: fileURLToPath(new URL('./index.html', import.meta.url)),
        en: fileURLToPath(new URL('./en.html', import.meta.url)),
      },
    },
  },
});
