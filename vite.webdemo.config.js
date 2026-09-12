import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web-demo',
  base: './',
  build: {
    outDir: '../dist-web-demo',
    emptyOutDir: true,
  },
});
