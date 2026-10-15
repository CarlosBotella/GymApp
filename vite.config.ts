import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH lo pone el workflow de GitHub Pages (/<repo>/). En local es "/".
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
});
