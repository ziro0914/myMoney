import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './store/supabase'

// 토스 거래내역이나 카드 승인 문자 캡처 한 장을 Claude로 읽는다.
// API 키는 브라우저에 두지 않고, Supabase Edge Function(supabase/functions/parse-screenshot)이 대신 호출한다.

export interface ScreenshotRow {
  /** 날짜 헤더의 월. 헤더가 안 보이면 null */
  month: number | null
  day: number | null
  /** HH:MM, 없으면 빈 문자열 */
  time: string
  title: string
  subtitle: string
  /** 원 단위. 출금은 음수 */
  amount: number
  balance: number | null
}

/** previousDate: 앞 캡처(또는 같은 캡처의 위쪽 조각)에서 마지막으로 본 날짜 'M월 D일' */
export async function parseScreenshot(jpegBase64: string, previousDate: string | null): Promise<ScreenshotRow[]> {
  if (!supabase) throw new Error('캡처 인식은 가족 공유(Supabase) 설정이 있어야 쓸 수 있어요.')
  const { data, error } = await supabase.functions.invoke<{ rows: ScreenshotRow[] }>('parse-screenshot', {
    body: { image: jpegBase64, previousDate },
  })
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null)
    throw new Error(body?.error ?? '캡처를 읽는 중 오류가 났어요.')
  }
  if (error) throw new Error('이미지 인식 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.')
  if (!data?.rows) throw new Error('캡처에서 거래를 읽지 못했어요.')
  return data.rows
}
