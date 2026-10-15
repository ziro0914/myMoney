const won = new Intl.NumberFormat('ko-KR')

export function formatWon(amount: number, signed = false): string {
  const sign = signed && amount > 0 ? '+' : amount < 0 ? '-' : ''
  return `${sign}${won.format(Math.abs(amount))}원`
}

/**
 * 가계부 한 달은 월급날(21일)부터 다음 달 20일까지다.
 * 기간은 끝나는 달로 부른다: '2026-10'은 2026-09-21 ~ 2026-10-20.
 * (그래서 원래 달력 기준으로 정해 둔 예산이 같은 기간에 그대로 이어진다.)
 */
export const CYCLE_START_DAY = 21

const pad = (n: number) => String(n).padStart(2, '0')

/** 날짜(YYYY-MM-DD)가 속한 가계부 기간 (YYYY-MM) */
export function monthOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return d >= CYCLE_START_DAY ? shiftMonth(`${y}-${pad(m)}`, 1) : `${y}-${pad(m)}`
}

export function currentMonth(): string {
  return monthOf(today())
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** 기간의 첫날과 마지막 날 (YYYY-MM-DD) */
export function monthRange(month: string): { start: string; end: string } {
  return { start: `${shiftMonth(month, -1)}-${CYCLE_START_DAY}`, end: `${month}-${pad(CYCLE_START_DAY - 1)}` }
}

/** 예: '9월 21일 ~ 10월 20일' (해가 바뀌는 기간은 '2025년 12월 21일 ~ 1월 20일') */
export function monthLabel(month: string): string {
  const { start, end } = monthRange(month)
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  const thisYear = new Date().getFullYear()
  const year = sy !== ey || ey !== thisYear ? `${sy}년 ` : ''
  return `${year}${sm}월 ${sd}일 ~ ${em}월 ${ed}일`
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}

export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
