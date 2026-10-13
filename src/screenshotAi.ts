import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'

// 토스 거래내역 캡처 한 장을 Claude로 읽는다.
// GitHub Pages에는 서버가 없어서 각자 폰에 저장한 API 키로 브라우저에서 바로 호출한다.
// (이 파일은 캡처를 올릴 때만 불러와서 첫 화면이 무거워지지 않게 한다.)

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

const PROMPT = `이 이미지는 한국 은행 앱(토스)의 거래내역 화면 캡처입니다. 보이는 거래를 위에서 아래 순서로 모두 뽑아 주세요.

- "10월 12일 월요일" 같은 날짜 헤더는 다음 헤더가 나올 때까지 그 아래 거래에 적용됩니다.
- 첫 날짜 헤더보다 위에 있는 거래는 {previous}
- 거래 한 줄은 보통 이렇게 생겼습니다: 첫 줄 굵은 글씨(title), 둘째 줄 "16:08 | 하남 젤라또"(time과 subtitle), 오른쪽 금액(amount), 그 아래 작은 회색 숫자(balance).
- 금액 앞에 - 가 있으면 음수, 없거나 + 이면 양수입니다. 쉼표와 "원"은 빼고 숫자만 적습니다.
- 위나 아래 가장자리에 잘려서 제목이나 금액이 다 보이지 않는 줄은 건너뜁니다.
- "소비 847,913원" 같은 요약, 버튼, 상태 표시줄은 거래가 아니니 무시합니다.
- 글자를 추측해서 채우지 말고 화면에 보이는 그대로 적습니다.`

/** previousDate: 앞 캡처(또는 같은 캡처의 위쪽 조각)에서 마지막으로 본 날짜 'M월 D일' */
export async function parseScreenshot(apiKey: string, jpegBase64: string, previousDate: string | null): Promise<ScreenshotRow[]> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
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
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpegBase64 } },
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
    if (response.stop_reason === 'refusal') throw new Error('이 이미지는 읽을 수 없어요.')
    if (response.stop_reason === 'max_tokens') throw new Error('거래가 너무 많아요. 캡처를 나눠서 올려 주세요.')
    if (!response.parsed_output) throw new Error('캡처에서 거래를 읽지 못했어요.')
    return response.parsed_output.rows
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('API 키가 올바르지 않아요. 설정에서 다시 넣어 주세요.')
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error('이 API 키로는 사용할 수 없어요. 키 권한이나 결제 상태를 확인해 주세요.')
    if (e instanceof Anthropic.RateLimitError) throw new Error('요청이 많아요. 잠시 후 다시 시도해 주세요.')
    if (e instanceof Anthropic.APIConnectionError) throw new Error('이미지 인식 서비스에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.')
    if (e instanceof Anthropic.APIError) throw new Error(`이미지 인식 서비스 오류 (${e.status}): ${e.message}`)
    throw e
  }
}
