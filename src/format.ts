const won = new Intl.NumberFormat('ko-KR')

export function formatWon(amount: number, signed = false): string {
  const sign = signed && amount > 0 ? '+' : amount < 0 ? '-' : ''
  return `${sign}${won.format(Math.abs(amount))}원`
}

/** YYYY-MM */
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${y}년 ${m}월`
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}

export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
