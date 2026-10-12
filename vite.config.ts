import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// 개발 서버에서도 /api/parse-screenshot (Vercel 함수)를 쓸 수 있게 연결한다.
function apiDevServer(): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use('/api/parse-screenshot', async (req, res) => {
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const mod = await server.ssrLoadModule('/api/parse-screenshot.ts')
        const response: Response = await mod.POST(
          new Request('http://localhost/api/parse-screenshot', {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: Buffer.concat(chunks),
          }),
        )
        res.statusCode = response.status
        response.headers.forEach((v, k) => res.setHeader(k, v))
        res.end(Buffer.from(await response.arrayBuffer()))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // 서버 함수가 읽는 ANTHROPIC_API_KEY 등을 .env에서 process.env로 올린다.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return { plugins: [react(), apiDevServer()] }
})
