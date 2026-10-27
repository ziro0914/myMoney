import type { Budget } from './types'

/**
 * 그 달에 적용되는 분류별 예산.
 * 분류마다 그 달이나 그 전 달 중 가장 최근에 정한 금액을 쓴다 (한 번 정하면 다음 달에도 이어짐).
 * 0으로 정한 달부터는 예산이 없다.
 */
export function budgetsFor(budgets: Budget[], month: string): Map<string, number> {
  const latest = new Map<string, Budget>()
  for (const b of budgets) {
    if (b.month > month) continue
    const cur = latest.get(b.category)
    if (!cur || b.month > cur.month) latest.set(b.category, b)
  }
  const result = new Map<string, number>()
  for (const [category, b] of latest) if (b.amount > 0) result.set(category, b.amount)
  return result
}

/** 예산 대비 쓴 비율(%) — 반올림, 예산이 0이면 0 */
export function usedPercent(spent: number, budget: number): number {
  return budget > 0 ? Math.round((spent / budget) * 100) : 0
}

/**
 * 오늘이 그 기간의 몇 %를 지났는지. 지난 기간은 100, 아직 오지 않은 기간은 0.
 * (start, end는 YYYY-MM-DD, 양 끝 포함)
 */
export function elapsedPercent(start: string, end: string, today: string): number {
  if (today < start) return 0
  if (today > end) return 100
  const day = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86_400_000
  const total = day(end) - day(start) + 1
  return Math.round(((day(today) - day(start) + 1) / total) * 100)
}
