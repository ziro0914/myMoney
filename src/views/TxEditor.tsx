import { useState } from 'react'
import { ALL_CATEGORIES, categorize } from '../categories'
import { today } from '../format'
import type { Transaction } from '../types'
import { matchesKeyword, type Ledger } from '../useLedger'

interface Props {
  ledger: Ledger
  /** 없으면 새 내역 입력 */
  tx?: Transaction
  close: () => void
}

export default function TxEditor({ ledger, tx, close }: Props) {
  const isNew = !tx
  const [date, setDate] = useState(tx?.date ?? today())
  const [description, setDescription] = useState(tx?.description ?? '')
  const [kind, setKind] = useState<'out' | 'in'>(tx && tx.amount > 0 ? 'in' : 'out')
  const [amount, setAmount] = useState(tx ? String(Math.abs(tx.amount)) : '')
  const [category, setCategory] = useState(tx?.category ?? '')
  const [memo, setMemo] = useState(tx?.memo ?? '')
  const [learn, setLearn] = useState(true)
  const [keyword, setKeyword] = useState(tx?.description || tx?.memo || '')
  const [busy, setBusy] = useState(false)

  const editable = isNew || tx.source === 'manual'
  const signed = (kind === 'out' ? -1 : 1) * Number(amount.replace(/[^\d]/g, ''))
  const effectiveCategory = category || categorize(description, signed, ledger.rules)
  const categoryChanged = !!tx && category !== tx.category
  const kw = keyword.trim()
  const sameCount = tx && kw ? ledger.transactions.filter((t) => t.id !== tx.id && matchesKeyword(t, kw)).length : 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (editable && (!signed || !date)) return
    setBusy(true)
    if (isNew) {
      await ledger.addTransactions([
        { date, time: '', amount: signed, description: description.trim(), category: effectiveCategory, memo, source: 'manual', dedupeKey: null, balance: null },
      ])
    } else {
      await ledger.updateTransaction(tx.id, editable ? { date, description: description.trim(), amount: signed, category, memo } : { category, memo })
      if (categoryChanged && learn && kw) await ledger.learnCategory(kw, category)
    }
    close()
  }

  async function remove() {
    if (!tx || !confirm('이 내역을 삭제할까요?')) return
    setBusy(true)
    await ledger.deleteTransaction(tx.id)
    close()
  }

  return (
    <div className="sheet-backdrop" onClick={close}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{isNew ? '직접 입력' : '내역 수정'}</h2>
        {editable ? (
          <>
            <div className="segmented">
              <button type="button" className={kind === 'out' ? 'active' : ''} onClick={() => setKind('out')}>지출</button>
              <button type="button" className={kind === 'in' ? 'active' : ''} onClick={() => setKind('in')}>수입</button>
            </div>
            <label>
              금액
              <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" required autoFocus={isNew} />
            </label>
            <label>
              날짜
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label>
              내용
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="예: 시장 장보기" />
            </label>
          </>
        ) : (
          <p className="readonly">
            <strong>{tx.description || '(내용 없음)'}</strong>
            <br />
            <span className="muted">
              {tx.date} {tx.time} · 토스에서 가져온 내역
            </span>
          </p>
        )}
        <label>
          분류
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {isNew && <option value="">자동 ({effectiveCategory})</option>}
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c === '내부이체' ? '내부이체 (통계 제외)' : c}</option>
            ))}
          </select>
        </label>
        {categoryChanged && (
          <div className="learn">
            <label className="check">
              <input type="checkbox" checked={learn} onChange={(e) => setLearn(e.target.checked)} />
              <span>
                내용이나 메모에 아래 단어가 들어간 내역은 앞으로 모두 {category}(으)로 분류{sameCount > 0 ? ` (기존 ${sameCount}건도 변경)` : ''}
              </span>
            </label>
            {learn && <input value={keyword} onChange={(e) => setKeyword(e.target.value)} aria-label="분류 규칙 단어" placeholder="예: 젤라또" />}
          </div>
        )}
        <label>
          메모
          <input value={memo} onChange={(e) => setMemo(e.target.value)} />
        </label>
        <div className="actions">
          {tx && (
            <button type="button" className="danger" onClick={remove} disabled={busy}>삭제</button>
          )}
          <span className="spacer" />
          <button type="button" onClick={close}>취소</button>
          <button type="submit" className="primary" disabled={busy}>저장</button>
        </div>
      </form>
    </div>
  )
}
