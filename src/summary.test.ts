import { describe, expect, it } from 'vitest'
import { summarize } from './summary'
import type { Transaction } from './types'

let n = 0
const tx = (amount: number, category: string, date = '2026-10-01'): Transaction => ({
  id: String(n++), date, time: '', amount, description: '', category, memo: '', source: 'manual', dedupeKey: null, balance: null,
})

describe('summarize', () => {
  it('지출 합계는 분류 목록의 합과 같다 (큰 입금이 지출 분류에 섞여도)', () => {
    const s = summarize([tx(-4_800_000, '미분류'), tx(-100_000, '쇼핑'), tx(4_500_000, '투자'), tx(500_000, '급여')], '2026-10')
    expect(s.categories).toEqual([['미분류', 4_800_000], ['쇼핑', 100_000]])
    expect(s.expense).toBe(4_900_000)
    expect(s.inflows).toEqual([['투자', 4_500_000]])
    expect(s.income).toBe(5_000_000)
    // 남은 돈(수입 - 지출)은 실제로 들어오고 나간 돈의 합과 같다
    expect(s.income - s.expense).toBe(-4_800_000 - 100_000 + 4_500_000 + 500_000)
  })
  it('환불은 같은 분류 지출에서 빠진다', () => {
    const s = summarize([tx(-50_000, '쇼핑'), tx(20_000, '쇼핑')], '2026-10')
    expect(s.categories).toEqual([['쇼핑', 30_000]])
    expect(s.inflows).toEqual([])
  })
  it('내부이체와 다른 기간은 빼고 센다', () => {
    const s = summarize([tx(-1_000, '내부이체'), tx(-2_000, '식비', '2026-10-21')], '2026-10')
    expect(s.expense).toBe(0)
  })
})
