import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        ru: fileURLToPath(new URL('./index.html', import.meta.url)),
        en: fileURLToPath(new URL('./en.html', import.meta.url)),
        delta: fileURLToPath(new URL('./delta.html', import.meta.url)),
        deltaEn: fileURLToPath(new URL('./delta-en.html', import.meta.url)),
        solok: fileURLToPath(new URL('./solok.html', import.meta.url)),
        solokEn: fileURLToPath(new URL('./solok-en.html', import.meta.url)),
      },
    },
  },
});
