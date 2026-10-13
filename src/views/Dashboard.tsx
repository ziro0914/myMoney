import { useMemo, useState } from 'react'
import { budgetsFor } from '../budget'
import { INCOME_CATEGORIES, isIncluded } from '../categories'
import { formatWon, monthOf, shiftMonth } from '../format'
import type { Transaction } from '../types'
import type { Ledger } from '../useLedger'
import BudgetEditor from './BudgetEditor'
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
  const budgets = useMemo(() => budgetsFor(ledger.budgets, month), [ledger.budgets, month])
  const [editingBudget, setEditingBudget] = useState(false)
  const totalBudget = [...budgets.values()].reduce((a, b) => a + b, 0)
  // 예산을 정한 분류의 지출만 예산과 비교한다.
  const budgetedSpent = now.categories.filter(([c]) => budgets.has(c)).reduce((a, [, v]) => a + v, 0)
  // 지출이 없어도 예산을 정한 분류는 보여준다.
  const rows = [...now.categories, ...[...budgets.keys()].filter((c) => !now.categories.some(([k]) => k === c)).map((c) => [c, 0] as [string, number])]
  const max = now.categories[0]?.[1] ?? 0
  const diff = now.expense - prev.expense
  const budgetEditor = editingBudget && <BudgetEditor ledger={ledger} month={month} close={() => setEditingBudget(false)} />

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
          {totalBudget > 0 && (
            <small className={budgetedSpent > totalBudget ? 'over' : 'muted'}>
              예산 {formatWon(totalBudget)} 중 {budgetedSpent > totalBudget ? `${formatWon(budgetedSpent - totalBudget)} 초과` : `${formatWon(totalBudget - budgetedSpent)} 남음`}
            </small>
          )}
        </div>
        <div className="tile">
          <span className="muted">수입</span>
          <strong className="income">{formatWon(now.income)}</strong>
          <small className="muted">남은 돈 {formatWon(now.income - now.expense, true)}</small>
        </div>
      </div>

      <div className="section-head">
        <h2>분류별 지출</h2>
        <button className="link" onClick={() => setEditingBudget(true)}>{budgets.size ? '예산 수정' : '예산 정하기'}</button>
      </div>
      {rows.length === 0 ? (
        <p className="muted">이번 달 지출 내역이 없어요.</p>
      ) : (
        <ul className="bars">
          {rows.map(([category, value]) => {
            const budget = budgets.get(category)
            const over = budget !== undefined && value > budget
            const ratio = budget ? value / budget : max ? value / max : 0
            return (
              <li key={category}>
                <button onClick={() => openCategory(category)} title={`${category} ${formatWon(value)}`}>
                  <span className="bar-label">
                    <span>{category}</span>
                    <span>
                      {formatWon(value)}{' '}
                      {budget ? (
                        <span className={over ? 'over' : 'muted'}>/ {formatWon(budget)}</span>
                      ) : (
                        <span className="muted">{now.expense ? Math.round((value / now.expense) * 100) : 0}%</span>
                      )}
                    </span>
                  </span>
                  <span className="bar-track">
                    <span className={`bar-fill${over ? ' over' : ''}`} style={{ width: `${Math.min(Math.max(ratio * 100, value ? 1 : 0), 100)}%` }} />
                  </span>
                  {budget !== undefined && (
                    <small className={over ? 'over' : 'muted'}>
                      {over ? `${formatWon(value - budget)} 초과` : `${formatWon(budget - value)} 남음`}
                    </small>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {budgetEditor}
    </section>
  )
}
