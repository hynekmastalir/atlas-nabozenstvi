import { defineConfig } from 'vite';

// Aplikace běží pod https://<uživatel>.github.io/atlas-nabozenstvi/kostra/
// Jiné umístění: BASE_PATH=/jiny-nazev/ npm run build
export default defineConfig({
  base: process.env.BASE_PATH || '/atlas-nabozenstvi/kostra/',
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
