// 카드 승인 문자 한 통을 내역 한 건으로 바꾼다. 서버 함수(add-card-sms)와 테스트가 같이 쓴다.
//
// 하나카드 문자 예:
//   [Web발신]
//   하나6*6*승인 강*호 84,000원
//   일시불 11/08 13:34 뽀로로테마파크다누적2,653,580원
// 가맹점 이름 바로 뒤에 '누적'이 띄어쓰기 없이 붙기도 한다.

export interface CardSms {
  /** YYYY-MM-DD */
  date: string
  /** HH:mm */
  time: string
  /** 승인은 음수, 취소는 양수 (원) */
  amount: number
  /** 가맹점 */
  merchant: string
  /** 예: '하나카드 일시불', '하나카드 3개월 취소' */
  memo: string
  /** 문자에 적힌 누적 이용금액, 없으면 null */
  total: number | null
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 문자에는 연도가 없어서, 오늘보다 미래가 되면 작년으로 본다. today는 YYYY-MM-DD(한국 날짜). */
export function resolveSmsDate(month: number, day: number, today: string): string {
  let year = Number(today.slice(0, 4))
  const md = `${pad(month)}-${pad(day)}`
  if (md > today.slice(5)) year--
  return `${year}-${md}`
}

const HANA =
  /하나\S*?(승인취소|취소|승인)\s*\S+\s+(-?[\d,]+)원\s*(일시불|\d+개월|할부\S*)?\s*(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})\s*([\s\S]*?)\s*(?:누적\s*(-?[\d,]+)원?|$)/

/** 하나카드 원화 승인·취소 문자가 아니면 null (광고, 해외 승인 등) */
export function parseCardSms(text: string, today: string): CardSms | null {
  const body = text.replace(/\[Web발신\]/g, ' ').replace(/\s+/g, ' ').trim()
  if (/\(광고\)/.test(body)) return null
  const m = HANA.exec(body)
  if (!m) return null
  const [, kind, amountText, plan, month, day, hour, minute, merchantText, totalText] = m
  const won = Math.abs(Number(amountText.replace(/,/g, '')))
  const merchant = merchantText.trim()
  if (!won || !merchant) return null
  const cancelled = kind !== '승인'
  return {
    date: resolveSmsDate(Number(month), Number(day), today),
    time: `${pad(Number(hour))}:${minute}`,
    amount: cancelled ? won : -won,
    merchant,
    memo: ['하나카드', plan, cancelled ? '취소' : ''].filter(Boolean).join(' '),
    total: totalText ? Number(totalText.replace(/,/g, '')) : null,
  }
}

/**
 * 같은 문자가 두 번 들어와도 한 번만 저장되도록 하는 키.
 * 누적 이용금액까지 넣어서, 같은 가게에서 같은 금액을 두 번 결제한 것은 따로 남는다.
 */
export function cardSmsDedupeKey(s: CardSms): string {
  return ['sms', s.date, s.time, s.amount, s.merchant, s.total ?? ''].join('|')
}
