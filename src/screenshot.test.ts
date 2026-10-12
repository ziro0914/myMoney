import { describe, expect, it } from 'vitest'
import { mergeOverlaps, resolveDate, toParsedRows } from './screenshot'

const today = new Date(2026, 9, 12)

describe('resolveDate', () => {
  it('미래 날짜는 작년으로 본다', () => {
    expect(resolveDate(10, 12, today)).toBe('2026-10-12')
    expect(resolveDate(12, 30, today)).toBe('2025-12-30')
  })
})

describe('toParsedRows', () => {
  it('캡처 결과를 내역으로 바꾼다', () => {
    const rows = toParsedRows(
      [
        { month: 10, day: 12, time: '16:08', title: '이새라', subtitle: '하남 젤라또', amount: -4270, balance: 98292 },
        { month: null, day: null, time: '8:37', title: '금옥어린이집', subtitle: '', amount: -88000, balance: 352005 },
      ],
      today,
      '2026-10-11',
    )
    expect(rows[0]).toEqual({ date: '2026-10-12', time: '16:08', amount: -4270, description: '이새라', memo: '하남 젤라또', balance: 98292 })
    expect(rows[1]).toMatchObject({ date: '2026-10-11', time: '08:37' })
  })
})

describe('mergeOverlaps', () => {
  it('겹친 캡처의 같은 거래를 하나로 합친다', () => {
    const r = { date: '2026-10-12', time: '12:58', amount: -5940, description: '쿠팡(쿠페이)', memo: '', balance: 308775 }
    expect(mergeOverlaps([r, { ...r }])).toHaveLength(1)
    expect(mergeOverlaps([{ ...r, balance: null }, { ...r, balance: null }])).toHaveLength(2)
  })
})
