import { describe, expect, it } from 'vitest'
import { budgetsFor } from './budget'

describe('budgetsFor', () => {
  const budgets = [
    { month: '2026-08', category: '식비', amount: 500000 },
    { month: '2026-10', category: '식비', amount: 600000 },
    { month: '2026-09', category: '쇼핑', amount: 200000 },
    { month: '2026-11', category: '쇼핑', amount: 0 },
  ]

  it('그 달에 정한 예산이 없으면 이전 달 예산을 이어서 쓴다', () => {
    expect(budgetsFor(budgets, '2026-09')).toEqual(new Map([['식비', 500000], ['쇼핑', 200000]]))
  })

  it('가장 최근에 정한 금액을 쓴다', () => {
    expect(budgetsFor(budgets, '2026-12').get('식비')).toBe(600000)
  })

  it('0으로 정한 달부터는 예산이 없다', () => {
    expect(budgetsFor(budgets, '2026-11').has('쇼핑')).toBe(false)
    expect(budgetsFor(budgets, '2026-10').get('쇼핑')).toBe(200000)
  })

  it('처음 정한 달보다 앞선 달에는 예산이 없다', () => {
    expect(budgetsFor(budgets, '2026-07').size).toBe(0)
  })
})

describe('소진율', () => {
  it('예산 대비 쓴 비율', async () => {
    const { usedPercent } = await import('./budget')
    expect(usedPercent(300_000, 600_000)).toBe(50)
    expect(usedPercent(660_000, 600_000)).toBe(110)
    expect(usedPercent(1, 0)).toBe(0)
  })
  it('기간이 얼마나 지났는지', async () => {
    const { elapsedPercent } = await import('./budget')
    // 9/21~10/20은 30일
    expect(elapsedPercent('2026-09-21', '2026-10-20', '2026-09-21')).toBe(3)
    expect(elapsedPercent('2026-09-21', '2026-10-20', '2026-10-05')).toBe(50)
    expect(elapsedPercent('2026-09-21', '2026-10-20', '2026-10-20')).toBe(100)
    expect(elapsedPercent('2026-09-21', '2026-10-20', '2026-11-01')).toBe(100)
    expect(elapsedPercent('2026-09-21', '2026-10-20', '2026-09-01')).toBe(0)
  })
})
