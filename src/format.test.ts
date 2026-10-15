import { describe, expect, it } from 'vitest'
import { monthLabel, monthOf, monthRange, shiftMonth } from './format'

describe('월급날(21일) 기준 기간', () => {
  it('21일부터는 다음 기간, 20일까지는 이번 기간', () => {
    expect(monthOf('2026-10-20')).toBe('2026-10')
    expect(monthOf('2026-10-21')).toBe('2026-11')
    expect(monthOf('2026-09-21')).toBe('2026-10')
    expect(monthOf('2026-12-21')).toBe('2027-01')
    expect(monthOf('2027-01-01')).toBe('2027-01')
  })
  it('기간의 처음과 끝', () => {
    expect(monthRange('2026-10')).toEqual({ start: '2026-09-21', end: '2026-10-20' })
    expect(monthRange('2027-01')).toEqual({ start: '2026-12-21', end: '2027-01-20' })
    expect(shiftMonth('2027-01', -1)).toBe('2026-12')
  })
  it('표시 이름', () => {
    const y = new Date().getFullYear()
    expect(monthLabel(`${y}-10`)).toBe('9월 21일 ~ 10월 20일')
    expect(monthLabel(`${y + 1}-01`)).toBe(`${y}년 12월 21일 ~ 1월 20일`)
  })
})
