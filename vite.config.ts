import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom', 'react-dom/client'] } } } },
  test: { include: ['src/**/*.test.{ts,tsx}'], environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: true },
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/tmp/**', '**/docs/qa/**'] } },
});
