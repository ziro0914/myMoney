import { describe, expect, it } from 'vitest'
import { cardSmsDedupeKey, parseCardSms, resolveSmsDate } from './cardSms'
import { categorize } from './categories'
import { planSmsInbox, SMS_INBOX_CATEGORY } from './smsInbox'
import type { Transaction } from './types'

const today = '2026-11-11'

describe('하나카드 승인 문자', () => {
  it('승인 문자를 지출 한 건으로 읽는다', () => {
    const text = '[Web발신]\n하나6*6*승인 강*호 200,000원\n일시불 11/05 16:07 국민카메라\n누적2,566,980원'
    expect(parseCardSms(text, today)).toEqual({
      date: '2026-11-05',
      time: '16:07',
      amount: -200000,
      merchant: '국민카메라',
      memo: '하나카드 일시불',
      total: 2566980,
    })
  })

  it('가맹점 뒤에 누적이 붙어 있어도 나눈다', () => {
    const s = parseCardSms('[Web발신]\n하나6*6*승인 강*호 84,000원\n일시불 11/08 13:34 뽀로로테마파크다누적2,653,580원', today)
    expect(s?.merchant).toBe('뽀로로테마파크다')
    expect(s?.amount).toBe(-84000)
    expect(s?.total).toBe(2653580)
  })

  it('취소는 양수, 할부도 읽는다', () => {
    expect(parseCardSms('[Web발신]\n하나6*6*취소 강*호 100원\n일시불 11/10 15:23 (주)워커스하이\n누적2,704,140원', today)).toMatchObject({
      amount: 100,
      merchant: '(주)워커스하이',
      memo: '하나카드 일시불 취소',
    })
    expect(parseCardSms('하나6*6*승인 강*호 1,200,000원 3개월 11/09 10:05 하이마트 누적3,000,000원', today)?.memo).toBe('하나카드 3개월')
  })

  it('광고나 다른 문자는 건너뛴다', () => {
    expect(parseCardSms('[Web발신]\n(광고)[하나카드] 지금! 변경하면 커피 최대 10잔!', today)).toBeNull()
    expect(parseCardSms('오늘 저녁 뭐 먹어?', today)).toBeNull()
  })

  it('연말 거래가 새해에 오면 작년으로 본다', () => {
    expect(resolveSmsDate(12, 31, '2027-01-01')).toBe('2026-12-31')
    expect(resolveSmsDate(1, 1, '2027-01-01')).toBe('2027-01-01')
  })

  it('누적 금액이 다르면 다른 거래로 본다', () => {
    const a = parseCardSms('하나6*6*승인 강*호 4,500원 일시불 11/10 09:00 스타벅스 누적100,000원', today)!
    const b = parseCardSms('하나6*6*승인 강*호 4,500원 일시불 11/10 09:00 스타벅스 누적104,500원', today)!
    expect(cardSmsDedupeKey(a)).not.toBe(cardSmsDedupeKey(b))
    expect(categorize(`${a.merchant} ${a.memo}`, a.amount, [])).toBe('카페·간식')
  })
})

const row = (id: string, patch: Partial<Transaction>): Transaction => ({
  id,
  date: '2000-01-01',
  time: '',
  amount: 0,
  description: '',
  category: SMS_INBOX_CATEGORY,
  memo: '',
  source: 'import',
  dedupeKey: null,
  balance: null,
  ...patch,
})

describe('단축어로 들어온 카드 문자', () => {
  const sms = '[Web발신]\n하나6*6*승인 강*호 84,000원\n일시불 11/08 13:34 뽀로로테마파크다누적2,653,580원'

  it('지출로 바꾸고, 광고와 같은 문자 두 번째는 지운다', () => {
    const plan = planSmsInbox(
      [row('a', { description: sms }), row('b', { description: sms }), row('c', { description: '(광고)[하나카드] 커피 10잔' })],
      [{ id: 'r', keyword: '뽀로로', category: '여가' }],
      today,
    )
    expect(plan.updates).toEqual([
      {
        id: 'a',
        patch: expect.objectContaining({ date: '2026-11-08', time: '13:34', amount: -84000, description: '뽀로로테마파크다', category: '여가' }),
      },
    ])
    expect(plan.deletes).toEqual(['b', 'c'])
  })

  it('캡처로 이미 넣은 거래면 지운다', () => {
    const saved = row('s', { date: '2026-11-08', time: '13:34', amount: -84000, description: '뽀로로테마파크', category: '여가' })
    expect(planSmsInbox([saved, row('a', { description: sms })], [], today)).toEqual({ updates: [], deletes: ['a'] })
  })
})
