import { INCOME_CATEGORIES, isIncluded } from './categories'
import { monthOf } from './format'
import type { Transaction } from './types'

const isIncomeCategory = (c: string) => (INCOME_CATEGORIES as readonly string[]).includes(c)

export interface Summary {
  /** 수입 분류 합계 + 지출 분류인데 들어온 돈이 더 많은 분류의 순입금 */
  income: number
  /** 분류별 지출(순지출이 양수인 분류)의 합. 아래 분류 목록의 합과 항상 같다. */
  expense: number
  /** 순지출이 큰 순서 [분류, 금액] */
  categories: [string, number][]
  /** 지출 분류인데 나간 돈보다 들어온 돈이 많은 분류 [분류, 순입금]. 분류를 잘못 넣은 입금일 수 있다. */
  inflows: [string, number][]
}

/**
 * 한 기간의 수입·지출을 분류별로 모은다.
 * 지출 분류에 들어온 입금(환불)은 그 분류 지출에서 빠지지만, 분류 단위로만 상계한다.
 * 그래서 큰 입금이 지출 분류에 잘못 들어가도 다른 분류의 지출을 지우지 않고, 수입 쪽에 따로 잡힌다.
 */
export function summarize(txs: Transaction[], month: string): Summary {
  let incomeCategories = 0
  const net = new Map<string, number>()
  for (const t of txs) {
    if (monthOf(t.date) !== month || !isIncluded(t.category)) continue
    if (isIncomeCategory(t.category)) incomeCategories += t.amount
    else net.set(t.category, (net.get(t.category) ?? 0) - t.amount)
  }
  const categories = [...net].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const inflows = [...net].filter(([, v]) => v < 0).map(([c, v]) => [c, -v] as [string, number]).sort((a, b) => b[1] - a[1])
  return {
    income: incomeCategories + inflows.reduce((a, [, v]) => a + v, 0),
    expense: categories.reduce((a, [, v]) => a + v, 0),
    categories,
    inflows,
  }
}
