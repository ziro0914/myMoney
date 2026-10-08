import { useMemo, useState } from 'react'
import { ALL_CATEGORIES, isIncluded } from '../categories'
import { dayLabel, formatWon, monthOf } from '../format'
import type { Transaction } from '../types'
import type { Ledger } from '../useLedger'
import MonthPicker from './MonthPicker'
import TxEditor from './TxEditor'

interface Props {
  ledger: Ledger
  month: string
  setMonth: (m: string) => void
  category: string | null
  setCategory: (c: string | null) => void
}

export default function TxList({ ledger, month, setMonth, category, setCategory }: Props) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Transaction | 'new' | null>(null)

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = ledger.transactions
      .filter((t) => monthOf(t.date) === month)
      .filter((t) => !category || t.category === category)
      .filter((t) => !q || `${t.description} ${t.memo}`.toLowerCase().includes(q))
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
    const byDate = new Map<string, Transaction[]>()
    for (const t of list) byDate.set(t.date, [...(byDate.get(t.date) ?? []), t])
    return [...byDate]
  }, [ledger.transactions, month, category, query])

  return (
    <section className="with-fab">
      <MonthPicker month={month} setMonth={setMonth} />
      <div className="filters">
        <input type="search" placeholder="검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={category ?? ''} onChange={(e) => setCategory(e.target.value || null)} aria-label="분류">
          <option value="">전체 분류</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {groups.length === 0 && <p className="muted center">내역이 없어요.</p>}
      {groups.map(([date, txs]) => (
        <div key={date} className="day">
          <h3>{dayLabel(date)}</h3>
          <ul>
            {txs.map((t) => (
              <li key={t.id}>
                <button className="tx" onClick={() => setEditing(t)}>
                  <span className="tx-main">
                    <span className="tx-desc">{t.description || '(내용 없음)'}</span>
                    <span className="muted small">
                      {t.time && `${t.time} · `}
                      <span className={t.category === '미분류' ? 'pill warn' : 'pill'}>{t.category}</span>
                      {t.memo && ` · ${t.memo}`}
                    </span>
                  </span>
                  <span className={`tx-amount ${t.amount > 0 ? 'income' : ''} ${isIncluded(t.category) ? '' : 'excluded'}`}>
                    {formatWon(t.amount, true)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <button className="fab" aria-label="직접 입력" onClick={() => setEditing('new')}>+</button>
      {editing && <TxEditor ledger={ledger} tx={editing === 'new' ? undefined : editing} close={() => setEditing(null)} />}
    </section>
  )
}
