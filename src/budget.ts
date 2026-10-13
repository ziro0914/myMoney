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
