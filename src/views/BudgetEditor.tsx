import { useState } from 'react'
import { budgetsFor } from '../budget'
import { EXPENSE_CATEGORIES } from '../categories'
import { formatWon, monthLabel } from '../format'
import type { Budget } from '../types'
import type { Ledger } from '../useLedger'

const CATEGORIES = EXPENSE_CATEGORIES.filter((c) => c !== '미분류')

const toNumber = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0
const withCommas = (v: string) => (toNumber(v) ? toNumber(v).toLocaleString('ko-KR') : '')

/** 그 달의 분류별 예산을 정한다. 정한 금액은 다음 달에도 이어진다. */
export default function BudgetEditor({ ledger, month, close }: { ledger: Ledger; month: string; close: () => void }) {
  const current = budgetsFor(ledger.budgets, month)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c, current.has(c) ? current.get(c)!.toLocaleString('ko-KR') : ''])),
  )
  const [busy, setBusy] = useState(false)
  const total = CATEGORIES.reduce((sum, c) => sum + toNumber(values[c]), 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const changed: Budget[] = CATEGORIES.filter((c) => toNumber(values[c]) !== (current.get(c) ?? 0)).map((c) => ({
      month,
      category: c,
      amount: toNumber(values[c]),
    }))
    setBusy(true)
    await ledger.saveBudgets(changed)
    close()
  }

  return (
    <div className="sheet-backdrop" onClick={close}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{monthLabel(month)} 예산</h2>
        <p className="muted small">정한 금액은 다음 달에도 그대로 이어져요. 비워 두면 그 분류는 예산이 없어요.</p>
        <ul className="budget-form">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <label htmlFor={`budget-${c}`}>{c}</label>
              <input
                id={`budget-${c}`}
                inputMode="numeric"
                placeholder="0"
                value={values[c]}
                onChange={(e) => setValues({ ...values, [c]: withCommas(e.target.value) })}
              />
            </li>
          ))}
        </ul>
        <p>
          합계 <strong>{formatWon(total)}</strong>
        </p>
        <div className="actions">
          <span className="spacer" />
          <button type="button" onClick={close}>취소</button>
          <button type="submit" className="primary" disabled={busy}>저장</button>
        </div>
      </form>
    </div>
  )
}
