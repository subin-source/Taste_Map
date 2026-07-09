import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // 👈 이 줄이 꼭 정확히 있어야 합니다!

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // 👈 여기서 위에서 불러온 tailwindcss를 실행해 줍니다.
  ],
})