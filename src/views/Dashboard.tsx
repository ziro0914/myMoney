import { useMemo } from 'react'
import { INCOME_CATEGORIES, isIncluded } from '../categories'
import { formatWon, monthOf, shiftMonth } from '../format'
import type { Transaction } from '../types'
import type { Ledger } from '../useLedger'
import MonthPicker from './MonthPicker'

interface Props {
  ledger: Ledger
  month: string
  setMonth: (m: string) => void
  openCategory: (c: string) => void
  goImport: () => void
}

const isIncomeCategory = (c: string) => (INCOME_CATEGORIES as readonly string[]).includes(c)

function summarize(txs: Transaction[], month: string) {
  let income = 0
  let expense = 0
  const byCategory = new Map<string, number>()
  for (const t of txs) {
    if (monthOf(t.date) !== month || !isIncluded(t.category)) continue
    if (isIncomeCategory(t.category)) income += t.amount
    else {
      // 지출 분류에 들어온 입금(환불)은 그 분류 지출에서 빠진다.
      expense -= t.amount
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) - t.amount)
    }
  }
  const categories = [...byCategory].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  return { income, expense, categories }
}

export default function Dashboard({ ledger, month, setMonth, openCategory, goImport }: Props) {
  const now = useMemo(() => summarize(ledger.transactions, month), [ledger.transactions, month])
  const prev = useMemo(() => summarize(ledger.transactions, shiftMonth(month, -1)), [ledger.transactions, month])
  const max = now.categories[0]?.[1] ?? 0
  const diff = now.expense - prev.expense

  if (ledger.transactions.length === 0) {
    return (
      <section className="empty">
        <h1>우리집 가계부</h1>
        <p className="muted">토스 앱에서 받은 거래내역 파일을 가져오면 자동으로 분류해서 보여드려요.</p>
        <button className="primary" onClick={goImport}>거래내역 가져오기</button>
      </section>
    )
  }

  return (
    <section>
      <MonthPicker month={month} setMonth={setMonth} />
      <div className="tiles">
        <div className="tile">
          <span className="muted">지출</span>
          <strong>{formatWon(now.expense)}</strong>
          {prev.expense > 0 && (
            <small className="muted">
              지난달보다 {formatWon(Math.abs(diff))} {diff > 0 ? '더 씀' : diff < 0 ? '덜 씀' : '(같음)'}
            </small>
          )}
        </div>
        <div className="tile">
          <span className="muted">수입</span>
          <strong className="income">{formatWon(now.income)}</strong>
          <small className="muted">남은 돈 {formatWon(now.income - now.expense, true)}</small>
        </div>
      </div>

      <h2>분류별 지출</h2>
      {now.categories.length === 0 ? (
        <p className="muted">이번 달 지출 내역이 없어요.</p>
      ) : (
        <ul className="bars">
          {now.categories.map(([category, value]) => (
            <li key={category}>
              <button onClick={() => openCategory(category)} title={`${category} ${formatWon(value)}`}>
                <span className="bar-label">
                  <span>{category}</span>
                  <span>
                    {formatWon(value)} <span className="muted">{Math.round((value / now.expense) * 100)}%</span>
                  </span>
                </span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width: `${Math.max((value / max) * 100, 1)}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
