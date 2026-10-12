import { describe, expect, it } from 'vitest'
import { categorize } from './categories'
import { findExisting, findHeader, parseCsv, parseDateTime, parseRows, toTransactions, withDedupeKeys } from './importer'

describe('parseDateTime', () => {
  it('여러 날짜 형식을 읽는다', () => {
    expect(parseDateTime('2026.10.01 12:34:56')).toEqual({ date: '2026-10-01', time: '12:34' })
    expect(parseDateTime('2026-1-5')).toEqual({ date: '2026-01-05', time: '' })
    expect(parseDateTime('2026년 3월 7일 09:05')).toEqual({ date: '2026-03-07', time: '09:05' })
    expect(parseDateTime('20261001')).toEqual({ date: '2026-10-01', time: '' })
    expect(parseDateTime(new Date(Date.UTC(2026, 9, 1, 8, 30)))).toEqual({ date: '2026-10-01', time: '08:30' })
    expect(parseDateTime('합계')).toBeNull()
  })
})

describe('토스뱅크 형식 엑셀', () => {
  const grid = [
    ['토스뱅크 거래내역'],
    ['계좌번호', '1000-0000-0000'],
    [],
    ['거래 일시', '적요', '거래 유형', '거래 기관', '계좌번호', '거래 금액', '거래 후 잔액', '메모'],
    ['2026.10.01 12:30:00', '스타벅스 강남점', '체크카드결제', '', '', '-5,600', '994,400', ''],
    ['2026.10.02 09:00:00', '홍길동', '입금', '', '', '1,000,000', '1,994,400', '용돈'],
    ['2026.10.03 18:00:00', '쿠팡', '체크카드결제', '', '', 32000, 1962400, ''],
  ]

  it('헤더를 찾고 금액 부호를 맞춘다', () => {
    const found = findHeader(grid)!
    expect(found.headerRow).toBe(3)
    const { rows, skipped } = parseRows(grid, found.headerRow, found.columns)
    expect(skipped).toBe(0)
    expect(rows.map((r) => r.amount)).toEqual([-5600, 1000000, -32000])
    expect(rows[1]).toMatchObject({ description: '홍길동', memo: '용돈', balance: 1994400, time: '09:00' })
  })

  it('자동으로 분류한다', () => {
    const found = findHeader(grid)!
    const txs = toTransactions(parseRows(grid, found.headerRow, found.columns).rows, [])
    expect(txs.map((t) => t.category)).toEqual(['카페·간식', '기타수입', '쇼핑'])
  })
})

describe('입금/출금 열이 따로 있는 CSV', () => {
  it('출금은 음수, 입금은 양수', () => {
    const grid = parseCsv('거래일자,거래시간,내용,출금액,입금액,잔액\r\n2026-10-01,10:00,"GS25 역삼점",3000,0,"97,000"\r\n2026-10-02,11:00,급여,,"3,000,000",3097000\r\n')
    const found = findHeader(grid)!
    const { rows } = parseRows(grid, found.headerRow, found.columns)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ amount: -3000, time: '10:00', balance: 97000 })
    expect(rows[1].amount).toBe(3000000)
  })
})

describe('withDedupeKeys', () => {
  it('파일 안의 똑같은 거래를 구분한다', () => {
    const r = { date: '2026-10-01', time: '', amount: -1000, description: 'CU', memo: '', balance: null }
    const keys = withDedupeKeys([r, r]).map((x) => x.dedupeKey)
    expect(new Set(keys).size).toBe(2)
  })
})

describe('categorize', () => {
  it('사용자 규칙이 기본 규칙보다 먼저다', () => {
    expect(categorize('쿠팡이츠', -15000, [])).toBe('식비')
    expect(categorize('쿠팡', -15000, [{ id: '1', keyword: '쿠팡', category: '마트·생활' }])).toBe('마트·생활')
  })
  it('기본 수입 규칙은 출금에 적용하지 않는다', () => {
    expect(categorize('급여통장 이체', -100000, [])).toBe('미분류')
  })
  it('환불은 원래 지출 분류로 들어간다', () => {
    expect(categorize('쿠팡 환불', 12000, [])).toBe('쇼핑')
  })
})

describe('findExisting', () => {
  const saved = {
    id: 'a', date: '2026-10-12', time: '16:08', amount: -4270, description: '이새라', category: '미분류',
    memo: '하남 젤라또', source: 'import' as const, dedupeKey: 'x', balance: 98292,
  }
  const fresh = { ...saved, description: '체크카드 이새라', memo: '', dedupeKey: 'y' }

  it('내용이 달라도 날짜·시간·금액·잔액이 같으면 같은 거래로 본다', () => {
    expect([...findExisting([fresh], [saved])]).toEqual([0])
  })
  it('잔액이 다르면 다른 거래다', () => {
    expect(findExisting([{ ...fresh, balance: 1 }], [saved]).size).toBe(0)
  })
  it('저장된 거래 하나는 새 거래 하나와만 짝짓는다', () => {
    expect([...findExisting([fresh, fresh], [saved])]).toEqual([0])
  })
})
