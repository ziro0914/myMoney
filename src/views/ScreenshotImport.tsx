import { useState } from 'react'
import { ALL_CATEGORIES, categorize } from '../categories'
import { findExisting, toTransactions } from '../importer'
import { readScreenshots } from '../screenshot'
import type { NewTransaction } from '../types'
import type { Ledger } from '../useLedger'

type Review = NewTransaction & { include: boolean; duplicate: boolean }

export default function ScreenshotImport({ ledger, done }: { ledger: Ledger; done: () => void }) {
  const [rows, setRows] = useState<Review[] | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onFiles(list: FileList | null) {
    const files = [...(list ?? [])]
    if (!files.length) return
    setError(null)
    setRows(null)
    try {
      const parsed = await readScreenshots(files, (n, total) => setProgress(`캡처 읽는 중… (${n}/${total})`))
      const txs = toTransactions(parsed, ledger.rules)
      const existing = findExisting(txs, ledger.transactions)
      setRows(txs.map((t, i) => ({ ...t, include: !existing.has(i), duplicate: existing.has(i) })))
      if (!txs.length) setError('캡처에서 거래를 찾지 못했어요.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '캡처를 읽지 못했어요.')
    } finally {
      setProgress(null)
    }
  }

  function edit(i: number, patch: Partial<Review>) {
    setRows((rs) =>
      rs!.map((r, j) => {
        if (j !== i) return r
        const next = { ...r, ...patch }
        // 내용·메모·금액을 고치면 분류도 다시 추천한다 (분류를 직접 고른 경우는 그대로).
        if (!('category' in patch) && ('description' in patch || 'memo' in patch || 'amount' in patch)) {
          next.category = categorize(`${next.description} ${next.memo}`, next.amount, ledger.rules)
        }
        return next
      }),
    )
  }

  async function save() {
    if (!rows) return
    setBusy(true)
    const picked = rows.filter((r) => r.include)
    // 고친 값 기준으로 중복 방지 키를 다시 만든다.
    const keyed = toTransactions(picked, ledger.rules).map((t, i) => ({ ...t, category: picked[i].category, memo: picked[i].memo }))
    const added = await ledger.addTransactions(keyed)
    setBusy(false)
    if (added) done()
  }

  const count = rows?.filter((r) => r.include).length ?? 0

  return (
    <div className="screenshot-import">
      <p className="or muted small">또는</p>
      <label className="file-drop">
        <input type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} disabled={!!progress} />
        <span>{progress ?? '토스 거래내역 캡처 올리기 (여러 장 가능)'}</span>
      </label>
      <p className="muted small">캡처를 AI가 읽어서 내역으로 바꿔요. 저장하기 전에 아래에서 확인하고 고칠 수 있어요.</p>
      {error && <p className="banner">{error}</p>}

      {rows && rows.length > 0 && (
        <>
          <p>
            <b>{count}건</b>을 저장합니다.
            {rows.some((r) => r.duplicate) && <span className="muted"> 이미 있는 것 같은 내역은 체크를 꺼 뒀어요.</span>}
          </p>
          <ul className="review">
            {rows.map((r, i) => (
              <li key={i} className={r.include ? '' : 'off'}>
                <div className="review-head">
                  <label className="check">
                    <input type="checkbox" checked={r.include} onChange={(e) => edit(i, { include: e.target.checked })} />
                    {r.duplicate ? <span className="pill warn">이미 있음?</span> : <span className="pill">새 내역</span>}
                  </label>
                  <input type="date" value={r.date} onChange={(e) => edit(i, { date: e.target.value })} aria-label="날짜" />
                  <input value={r.time} onChange={(e) => edit(i, { time: e.target.value })} aria-label="시간" placeholder="시간" className="time" />
                </div>
                <div className="review-grid">
                  <input value={r.description} onChange={(e) => edit(i, { description: e.target.value })} aria-label="내용" placeholder="내용" />
                  <input
                    inputMode="numeric"
                    value={String(r.amount)}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/[^\d-]/g, ''))
                      if (Number.isFinite(n)) edit(i, { amount: n })
                    }}
                    aria-label="금액 (출금은 -)"
                    className={r.amount > 0 ? 'income' : ''}
                  />
                  <input value={r.memo} onChange={(e) => edit(i, { memo: e.target.value })} aria-label="메모" placeholder="메모" />
                  <select value={r.category} onChange={(e) => edit(i, { category: e.target.value })} aria-label="분류">
                    {ALL_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
          <button className="primary block" disabled={busy || count === 0} onClick={save}>
            {busy ? '저장 중…' : `${count}건 저장`}
          </button>
        </>
      )}
    </div>
  )
}
