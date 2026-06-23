import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: update `base` to match your GitHub Pages repo name, e.g. '/trials-dashboard/'
export default defineConfig({
  plugins: [react()],
  base: '/trials-dashboard/',
})
