import { defineConfig } from 'vite';
export default defineConfig({
  build: { rollupOptions: { output: { manualChunks(id) {
    if (id.includes('node_modules/three')) return 'three';
    if (id.includes('koi-anatomy.json')) return 'koi-model';
    if (id.includes('stones.json')) return 'river-stones';
  } } } },
});
