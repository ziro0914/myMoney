import { useState } from 'react'
import { BOOK, BOOK_TITLE } from '../book'
import { ALL_CATEGORIES } from '../categories'
import type { Ledger } from '../useLedger'

function exportCsv(ledger: Ledger) {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [
    ['날짜', '시간', '내용', '금액', '분류', '메모', '잔액', '출처'].join(','),
    ...[...ledger.transactions]
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map((t) => [t.date, t.time, t.description, t.amount, t.category, t.memo, t.balance, t.source === 'import' ? '가져오기' : '직접입력'].map(esc).join(',')),
  ]
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `가계부-백업-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function SettingsView({
  ledger,
  mode,
  user,
  switchUser,
}: {
  ledger: Ledger
  mode: 'local' | 'shared'
  user: string
  switchUser?: () => void
}) {
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('식비')
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <section>
      <h1>설정</h1>

      <div className={`banner ${mode === 'local' ? '' : 'ok'}`}>
        {mode === 'local'
          ? '지금은 이 기기 브라우저에만 저장돼요. 여러 기기에서 보려면 README의 Supabase 설정을 해 주세요.'
          : BOOK !== 'family'
            ? `${BOOK_TITLE} — 다른 가계부와 따로 저장돼요.`
            : '가족 공유 모드 — 둘이 같은 가계부를 봐요.'}
      </div>

      <h2>자동 분류 규칙</h2>
      <p className="muted small">내용에 키워드가 들어 있으면 그 분류로 넣어요. 내역에서 분류를 바꾸면 규칙이 자동으로 추가돼요.</p>
      <form
        className="rule-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!keyword.trim()) return
          await ledger.saveRule(keyword.trim(), category)
          setKeyword('')
        }}
      >
        <input placeholder="키워드 (예: 동네마트)" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {ALL_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button className="primary">추가</button>
      </form>
      <ul className="rules">
        {ledger.rules.map((r) => (
          <li key={r.id}>
            <span>{r.keyword}</span>
            <span className="pill">{r.category}</span>
            <button className="link danger" onClick={() => ledger.deleteRule(r.id)}>삭제</button>
          </li>
        ))}
        {ledger.rules.length === 0 && <li className="muted small">아직 직접 만든 규칙이 없어요.</li>}
      </ul>
      <button
        onClick={async () => {
          const n = await ledger.reapplyRules()
          if (n !== undefined) setNotice(`${n}건을 다시 분류했어요.`)
        }}
      >
        미분류 내역에 규칙 다시 적용
      </button>
      {notice && <p className="muted small">{notice}</p>}

      <h2>데이터</h2>
      <div className="stack">
        <button onClick={() => exportCsv(ledger)}>전체 내역 CSV로 백업</button>
        {switchUser && <button onClick={switchUser}>사용자 바꾸기 (지금: {user})</button>}
      </div>
    </section>
  )
}
