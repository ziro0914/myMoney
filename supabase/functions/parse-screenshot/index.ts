// 토스 거래내역 캡처나 카드 승인 문자 캡처 한 장을 Claude로 읽는 서버 함수.
// API 키는 Supabase 시크릿(ANTHROPIC_API_KEY)에만 있고 브라우저로 내려가지 않는다.
import Anthropic from 'npm:@anthropic-ai/sdk@^0.133.0'
import { betaZodOutputFormat } from 'npm:@anthropic-ai/sdk@^0.133.0/helpers/beta/zod'
import { z } from 'npm:zod@^4.6.6'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const Row = z.object({
  month: z.number().int().nullable().describe('거래 날짜의 월. 안 보이면 null'),
  day: z.number().int().nullable().describe('거래 날짜의 일. 안 보이면 null'),
  time: z.string().describe('HH:MM, 없으면 빈 문자열'),
  title: z.string().describe('상대방이나 가맹점 이름'),
  subtitle: z.string().describe('메모나 카드 정보 (예: 삼성2723 해외승인), 없으면 빈 문자열'),
  amount: z.number().describe('표시된 통화 기준 금액. 쉼표와 기호는 빼고 숫자만. 출금·승인은 음수, 입금·취소는 양수'),
  currency: z.string().describe('통화 코드. 원화면 KRW, 그 밖에는 USD처럼 표시된 그대로'),
  balance: z.number().int().nullable().describe('거래 후 잔액 (원), 없으면 null'),
})

const Result = z.object({ rows: z.array(Row) })

const PROMPT = `이 이미지는 한국 은행 앱(토스 등)의 거래내역 화면이나, 카드 승인 문자 메시지 화면 캡처입니다. 보이는 거래를 위에서 아래 순서로 모두 뽑아 주세요.

거래내역 화면일 때:
- "10월 12일 월요일" 같은 날짜 헤더는 다음 헤더가 나올 때까지 그 아래 거래에 적용됩니다.
- 첫 날짜 헤더보다 위에 있는 거래는 {previous}
- 거래 한 줄은 보통 이렇게 생겼습니다: 첫 줄 굵은 글씨(title), 둘째 줄 "16:08 | 하남 젤라또"(time과 subtitle), 오른쪽 금액(amount), 그 아래 작은 회색 숫자(balance).
- 금액 앞에 - 가 있으면 음수, 없거나 + 이면 양수입니다.

카드 문자일 때:
- 승인 문자 하나가 거래 하나입니다. 예: "삼성2723해외승인 강*호 / USD 22.00 / 10/13 22:00 ANTHROPIC" → month 10, day 13, time "22:00", title "ANTHROPIC", subtitle "삼성2723 해외승인", amount -22.00, currency "USD".
- 승인은 지출이라 음수, "취소" 문자는 양수입니다. 금액이 0인 승인(카드 확인용)도 그대로 적습니다.
- 수수료 안내, 차단 안내, 광고 같은 문자는 거래가 아니니 무시합니다.
- 같은 승인 문자가 두 번 보이면 한 번만 적습니다.

공통:
- 쉼표와 "원"은 빼고 숫자만 적습니다. 원화가 아니면 소수점까지 그대로 적고 currency에 통화 코드를 적습니다.
- 위나 아래 가장자리에 잘려서 가맹점이나 금액이 다 보이지 않는 거래는 건너뜁니다.
- 요약, 버튼, 상태 표시줄, 입력창은 거래가 아니니 무시합니다.
- 글자를 추측해서 채우지 말고 화면에 보이는 그대로 적습니다.`

/** 원화가 아닌 금액을 오늘 환율로 원화로 바꾼다. */
async function krwRates(currencies: string[]): Promise<Record<string, number>> {
  const rates: Record<string, number> = {}
  for (const c of currencies) {
    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(c)}`)
    const body = await res.json().catch(() => null)
    const rate = body?.rates?.KRW
    if (typeof rate !== 'number') throw new Error(`${c} 환율을 가져오지 못했어요.`)
    rates[c] = rate
  }
  return rates
}

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** 요청: { image: JPEG base64, previousDate: 'M월 D일' | null } → 응답: { rows } 또는 { error } */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'POST만 받아요.' }, 405)

  const { image, previousDate } = await req.json().catch(() => ({}))
  if (typeof image !== 'string' || !image) return reply({ error: '캡처 이미지가 없어요.' }, 400)

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
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
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
    if (response.stop_reason === 'refusal') return reply({ error: '이 이미지는 읽을 수 없어요.' }, 422)
    if (response.stop_reason === 'max_tokens') return reply({ error: '거래가 너무 많아요. 캡처를 나눠서 올려 주세요.' }, 422)
    if (!response.parsed_output) return reply({ error: '캡처에서 거래를 읽지 못했어요.' }, 422)
    const rows = response.parsed_output.rows
    const foreign = [...new Set(rows.map((r) => r.currency.toUpperCase()).filter((c) => c !== 'KRW'))]
    let rates: Record<string, number>
    try {
      rates = await krwRates(foreign)
    } catch (e) {
      return reply({ error: (e as Error).message }, 502)
    }
    return reply({
      rows: rows.map(({ currency, ...r }) => {
        const c = currency.toUpperCase()
        if (c === 'KRW') return { ...r, amount: Math.round(r.amount) }
        const original = `${c} ${Math.abs(r.amount).toFixed(2)}`
        return {
          ...r,
          amount: Math.round(r.amount * rates[c]),
          subtitle: [r.subtitle, `${original} (환율 ${Math.round(rates[c]).toLocaleString('ko-KR')}원)`].filter(Boolean).join(' · '),
        }
      }),
    })
  } catch (e) {
    console.error(e)
    if (e instanceof Anthropic.RateLimitError) return reply({ error: '요청이 많아요. 잠시 후 다시 시도해 주세요.' }, 429)
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      return reply({ error: '서버의 API 키에 문제가 있어요. 키나 결제 상태를 확인해 주세요.' }, 502)
    if (e instanceof Anthropic.APIError) return reply({ error: `이미지 인식 서비스 오류 (${e.status})` }, 502)
    return reply({ error: '캡처를 읽는 중 오류가 났어요.' }, 500)
  }
})
