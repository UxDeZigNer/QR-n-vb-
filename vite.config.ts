import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relativ base — həm GitHub Pages (/QR-n-vb-/), həm kök domen (qr.free.je) üçün işləyir
  base: './',
  plugins: [react(), tailwindcss()],
})
