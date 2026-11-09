import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || '/',
    server: {
      port: 3009,
      strictPort: true,
    },
    build: { chunkSizeWarningLimit: 1500 },
    test: { environment: 'jsdom', clearMocks: true },
  };
});

