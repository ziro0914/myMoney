import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// 토스 거래내역 캡처 한 장을 받아 Claude로 거래 목록을 읽어 돌려준다.
// API 키는 서버(Vercel 함수)에만 두고, 가족으로 등록된 사람만 부를 수 있게 막는다.

const Row = z.object({
  month: z.number().int().nullable().describe('날짜 헤더의 월. 헤더가 안 보이면 null'),
  day: z.number().int().nullable().describe('날짜 헤더의 일. 헤더가 안 보이면 null'),
  time: z.string().describe('HH:MM, 없으면 빈 문자열'),
  title: z.string().describe('굵은 첫 줄 (상대방이나 가맹점 이름)'),
  subtitle: z.string().describe('둘째 줄에서 시간과 | 를 뺀 나머지 (메모 등), 없으면 빈 문자열'),
  amount: z.number().int().describe('원 단위. 출금(- 표시)은 음수, 입금은 양수'),
  balance: z.number().int().nullable().describe('금액 아래 회색 숫자 (거래 후 잔액), 없으면 null'),
})

const Result = z.object({ rows: z.array(Row) })

export type ScreenshotRow = z.infer<typeof Row>

const Body = z.object({
  image: z.string().min(1),
  mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  /** 앞 캡처(또는 같은 캡처의 위쪽 조각)에서 마지막으로 본 날짜 'M월 D일' */
  previousDate: z.string().nullable().optional(),
})

const PROMPT = `이 이미지는 한국 은행 앱(토스)의 거래내역 화면 캡처입니다. 보이는 거래를 위에서 아래 순서로 모두 뽑아 주세요.

- "10월 12일 월요일" 같은 날짜 헤더는 다음 헤더가 나올 때까지 그 아래 거래에 적용됩니다.
- 첫 날짜 헤더보다 위에 있는 거래는 {previous}
- 거래 한 줄은 보통 이렇게 생겼습니다: 첫 줄 굵은 글씨(title), 둘째 줄 "16:08 | 하남 젤라또"(time과 subtitle), 오른쪽 금액(amount), 그 아래 작은 회색 숫자(balance).
- 금액 앞에 - 가 있으면 음수, 없거나 + 이면 양수입니다. 쉼표와 "원"은 빼고 숫자만 적습니다.
- 위나 아래 가장자리에 잘려서 제목이나 금액이 다 보이지 않는 줄은 건너뜁니다.
- "소비 847,913원" 같은 요약, 버튼, 상태 표시줄은 거래가 아니니 무시합니다.
- 글자를 추측해서 채우지 말고 화면에 보이는 그대로 적습니다.`

async function isFamilyMember(authorization: string | null): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  const token = authorization?.replace(/^Bearer\s+/i, '')
  if (!url || !key || !token) return false
  const db = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: user } = await db.auth.getUser(token)
  if (!user.user) return false
  const { data, error } = await db.rpc('is_member')
  return !error && data === true
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export async function POST(request: Request): Promise<Response> {
  // 로컬 개발 서버(vite)에서는 SKIP_SCREENSHOT_AUTH=1 로 인증을 건너뛸 수 있다.
  if (process.env.SKIP_SCREENSHOT_AUTH !== '1' && !(await isFamilyMember(request.headers.get('authorization')))) {
    return json({ error: '가족으로 등록된 계정으로 로그인해야 캡처를 읽을 수 있어요.' }, 401)
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: '서버에 ANTHROPIC_API_KEY가 설정되지 않았어요.' }, 500)
  }

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: '잘못된 요청이에요.' }, 400)
  const { image, mediaType, previousDate } = parsed.data

  const client = new Anthropic()
  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(Result) },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            {
              type: 'text',
              text: PROMPT.replace(
                '{previous}',
                previousDate ? `${previousDate} 거래로 봅니다 (앞 화면에서 이어짐).` : 'month와 day를 null로 둡니다.',
              ),
            },
          ],
        },
      ],
    })
    if (response.stop_reason === 'refusal') return json({ error: '이 이미지는 읽을 수 없어요.' }, 422)
    if (response.stop_reason === 'max_tokens') return json({ error: '거래가 너무 많아요. 캡처를 나눠서 올려 주세요.' }, 422)
    if (!response.parsed_output) return json({ error: '캡처에서 거래를 읽지 못했어요.' }, 422)
    return json(response.parsed_output)
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: '요청이 많아요. 잠시 후 다시 시도해 주세요.' }, 429)
    if (e instanceof Anthropic.AuthenticationError) return json({ error: '서버의 ANTHROPIC_API_KEY가 올바르지 않아요.' }, 500)
    if (e instanceof Anthropic.APIError) return json({ error: `이미지 인식 서비스 오류 (${e.status})` }, 502)
    throw e
  }
}
