// 아이폰 단축어가 카드 문자를 받으면 내용 그대로 내역 테이블에 넣어 둔다 (분류 '카드문자', 금액 0).
// 앱을 열 때 그 줄들을 문자 내용대로 진짜 지출로 바꾼다. 서버 함수 없이 단축어 하나로 되게 하려는 것.
import { cardSmsDedupeKey, parseCardSms } from './cardSms'
import { categorize } from './categories'
import { findExisting } from './importer'
import type { NewTransaction, Rule, Transaction } from './types'

/** 단축어가 넣는 줄의 분류. 앱을 열면 바로 바뀌어서 화면에는 보이지 않는다. */
export const SMS_INBOX_CATEGORY = '카드문자'

export interface InboxPlan {
  updates: { id: string; patch: Partial<NewTransaction> }[]
  /** 카드 승인 문자가 아니거나, 이미 있는 거래라서 지울 줄 */
  deletes: string[]
}

/** today는 YYYY-MM-DD (문자에 연도가 없어서 필요) */
export function planSmsInbox(transactions: Transaction[], rules: Rule[], today: string): InboxPlan {
  const pending = transactions.filter((t) => t.category === SMS_INBOX_CATEGORY)
  const saved = transactions.filter((t) => t.category !== SMS_INBOX_CATEGORY)
  const plan: InboxPlan = { updates: [], deletes: [] }
  const seenKeys = new Set<string>()
  for (const t of pending) {
    const sms = parseCardSms(t.description, today)
    if (!sms) {
      plan.deletes.push(t.id)
      continue
    }
    const tx: NewTransaction = {
      date: sms.date,
      time: sms.time,
      amount: sms.amount,
      description: sms.merchant,
      memo: sms.memo,
      category: categorize(`${sms.merchant} ${sms.memo}`, sms.amount, rules),
      source: 'import',
      dedupeKey: cardSmsDedupeKey(sms),
      balance: null,
    }
    // 같은 문자가 두 번 왔거나, 캡처·파일로 이미 넣은 거래면 지운다.
    if (seenKeys.has(tx.dedupeKey!) || findExisting([tx], saved).size) {
      plan.deletes.push(t.id)
      continue
    }
    seenKeys.add(tx.dedupeKey!)
    plan.updates.push({ id: t.id, patch: tx })
  }
  return plan
}
