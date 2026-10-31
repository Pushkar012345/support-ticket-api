import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Our backend CORS setting allows only port 5173, so fail loudly if it's taken
  // instead of silently moving to 5174.
  server: { port: 5173, strictPort: true },
})