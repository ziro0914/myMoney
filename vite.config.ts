import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// 빌드할 때 VITE_BOOK=personal 이면 개인 가계부, 아니면 가족 가계부를 만든다 (src/book.ts).
const book = process.env.VITE_BOOK === 'personal' ? 'personal' : 'family'
const title = book === 'personal' ? '내 가계부' : '우리집 가계부'
const shortName = book === 'personal' ? '내 가계부' : '가족 가계부'
const ICONS = ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']

/** 가계부마다 다른 제목·아이콘·매니페스트를 넣는다. 홈 화면에서 둘을 구분할 수 있게. */
function bookAssets(): Plugin {
  const manifest = JSON.stringify({
    name: title,
    short_name: shortName,
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#f4f4f2',
    theme_color: '#f4f4f2',
    lang: 'ko',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  })
  const iconPath = (name: string) => new URL(`./icons/${book}/${name}`, import.meta.url)
  return {
    name: 'book-assets',
    transformIndexHtml: (html) => html.replaceAll('__APP_TITLE__', title).replaceAll('__APP_SHORT_NAME__', shortName),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split('?')[0].split('/').pop() ?? ''
        if (name === 'manifest.webmanifest') return res.end(manifest)
        if (ICONS.includes(name)) {
          res.setHeader('content-type', name.endsWith('.svg') ? 'image/svg+xml' : 'image/png')
          return res.end(readFileSync(iconPath(name)))
        }
        next()
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest })
      for (const name of ICONS) this.emitFile({ type: 'asset', fileName: name, source: readFileSync(iconPath(name)) })
    },
  }
}

// GitHub Pages 하위 경로에서도 동작하도록 상대 경로로 빌드한다.
export default defineConfig({
  base: './',
  plugins: [react(), bookAssets()],
})
