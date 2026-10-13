import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages(https://ziro0914.github.io/storeBook/)에서도 동작하도록 상대 경로로 빌드한다.
export default defineConfig({
  base: './',
  plugins: [react()],
})
