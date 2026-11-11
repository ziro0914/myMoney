// 아이폰 단축어가 카드 승인 문자를 받자마자 보내 주면 가계부 지출로 바로 저장하는 서버 함수.
// AI를 쓰지 않고 문자 형식으로 읽어서 요금이 들지 않는다.
//
// 요청: POST { text: 문자 내용, book: 'family' | 'personal' | 'saera', token: SMS_TOKEN 시크릿과 같은 값 }
// 응답: { ok, message } — message는 단축어 알림에 그대로 보여 줄 문장
import { createClient } from 'npm:@supabase/supabase-js@^2.117.3'
import { type Book, type Rule, categorizeFor } from '../_shared/categories.ts'
import { cardSmsDedupeKey, parseCardSms } from '../_shared/cardSms.ts'

const BOOKS: Record<Book, { prefix: string; owner: string | null; title: string }> = {
  family: { prefix: '', owner: null, title: '우리집 가계부' },
  personal: { prefix: 'personal_', owner: 'me', title: '내 가계부' },
  saera: { prefix: 'personal_', owner: 'saera', title: '새라 가계부' },
}

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const reply = (ok: boolean, message: string, status = 200) =>
  new Response(JSON.stringify({ ok, message }), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

/** 한국 시간 기준 오늘 (YYYY-MM-DD) */
const koreaToday = () => new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(false, 'POST만 받아요.', 405)
  const { text, book, token } = await req.json().catch(() => ({}))

  const secret = Deno.env.get('SMS_TOKEN')
  if (!secret || token !== secret) return reply(false, '토큰이 맞지 않아요.', 401)
  const target = BOOKS[book as Book]
  if (!target) return reply(false, `book은 family, personal, saera 중 하나여야 해요.`, 400)
  if (typeof text !== 'string' || !text.trim()) return reply(false, '문자 내용이 없어요.', 400)

  const sms = parseCardSms(text, koreaToday())
  // 광고·안내 문자는 거래가 아니니 조용히 넘긴다 (단축어가 오류로 멈추지 않게 200).
  if (!sms) return reply(false, '카드 승인 문자가 아니라 건너뛰었어요.')

  const tx = `${target.prefix}transactions`
  const mine = <Q extends { eq(c: string, v: string): Q }>(q: Q): Q => (target.owner ? q.eq('owner', target.owner) : q)

  const { data: rules, error: rulesError } = await mine(db.from(`${target.prefix}rules`).select('id, keyword, category'))
  if (rulesError) return reply(false, `규칙을 읽지 못했어요: ${rulesError.message}`, 500)

  // 캡처나 파일로 이미 넣은 같은 거래가 있으면 넣지 않는다 (날짜·금액이 같고, 시간이 같거나 비어 있는 것).
  // 문자로 넣은 내역끼리는 중복 방지 키(누적 금액 포함)로만 가려서, 같은 가게에서 두 번 결제한 것도 남긴다.
  const { data: same, error: findError } = await mine(
    db.from(tx).select('time, dedupe_key').eq('date', sms.date).eq('amount', sms.amount),
  )
  if (findError) return reply(false, `내역을 읽지 못했어요: ${findError.message}`, 500)
  const dedupeKey = cardSmsDedupeKey(sms)
  const won = `${Math.abs(sms.amount).toLocaleString('ko-KR')}원`
  const duplicate = (same ?? []).some(
    (t: { time: string; dedupe_key: string | null }) =>
      t.dedupe_key === dedupeKey || (!t.dedupe_key?.startsWith('sms|') && (!t.time || t.time === sms.time)),
  )
  if (duplicate)
    return reply(true, `이미 있는 내역이에요: ${sms.merchant} ${won}`)

  const category = categorizeFor(book as Book, `${sms.merchant} ${sms.memo}`, sms.amount, (rules ?? []) as Rule[])
  const row = {
    date: sms.date,
    time: sms.time,
    amount: sms.amount,
    description: sms.merchant,
    memo: sms.memo,
    category,
    source: 'import',
    dedupe_key: dedupeKey,
    balance: null,
    ...(target.owner ? { owner: target.owner } : {}),
  }
  const { error } = await db
    .from(tx)
    .upsert(row, { onConflict: target.owner ? 'owner,dedupe_key' : 'dedupe_key', ignoreDuplicates: true })
  if (error) return reply(false, `저장하지 못했어요: ${error.message}`, 500)

  const sign = sms.amount < 0 ? '' : '취소 +'
  return reply(true, `${target.title}에 넣었어요: ${sms.merchant} ${sign}${won} (${category})`)
})
