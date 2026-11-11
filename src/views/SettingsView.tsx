import { useState } from 'react'
import { BOOK, BOOK_TITLE, OWNER, TABLE_PREFIX } from '../book'
import { ALL_CATEGORIES } from '../categories'
import { SMS_INBOX_CATEGORY } from '../smsInbox'
import { key as supabaseKey, url as supabaseUrl } from '../store/supabase'
import type { Ledger } from '../useLedger'

function Copy({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <li className="copy-row">
      <span className="muted small">{label}</span>
      <code>{value}</code>
      <button
        type="button"
        className="link"
        onClick={async () => {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
      >
        {copied ? '복사됨' : '복사'}
      </button>
    </li>
  )
}

/** 아이폰 단축어로 카드 문자를 바로 넣는 법. 단축어에 그대로 붙여 넣을 값을 보여 준다. */
function SmsShortcutGuide() {
  if (!supabaseUrl || !supabaseKey) return null
  return (
    <details className="sms-guide">
      <summary>
        <h2>카드 문자 자동 입력 (아이폰 단축어)</h2>
      </summary>
      <p className="muted small">
        하나카드 승인 문자가 오면 단축어가 이 가계부로 보내요. 앱을 열면 지출로 바뀌어 있어요. 광고 문자는 버리고, 취소 문자는 +로
        넣어요.
      </p>
      <ol className="small">
        <li>단축어 앱 → 아래 <b>자동화</b> → 오른쪽 위 <b>+</b> → <b>메시지</b></li>
        <li>
          <b>메시지에 포함</b>에 <code>누적</code> 입력 → <b>즉시 실행</b> 선택 → <b>다음</b>
        </li>
        <li>
          <b>새로운 빈 단축어</b> → <b>URL 콘텐츠 가져오기</b> 추가 → 파란 <b>URL</b> 자리에 아래 주소 붙여 넣기
        </li>
        <li>
          <b>방법</b>을 <b>POST</b>로. <b>헤더</b>에 아래 두 개 추가
        </li>
        <li>
          <b>요청 본문</b>은 <b>JSON</b>. 아래 칸을 <b>텍스트</b>로 추가하고, <code>description</code> 값은 키보드 위의 <b>단축어 입력</b>을
          누른 뒤 <b>메시지</b> → <b>내용</b>으로 바꾸기
        </li>
      </ol>
      <ul className="copy-list">
        <Copy label="URL" value={`${supabaseUrl}/rest/v1/${TABLE_PREFIX}transactions`} />
        <Copy label="헤더 apikey" value={supabaseKey} />
        <Copy label="헤더 Authorization" value={`Bearer ${supabaseKey}`} />
        <Copy label="본문 date" value="2000-01-01" />
        <Copy label="본문 amount (숫자)" value="0" />
        <Copy label="본문 category" value={SMS_INBOX_CATEGORY} />
        <Copy label="본문 source" value="import" />
        {OWNER && OWNER !== 'me' && <Copy label="본문 owner" value={OWNER} />}
        <li className="copy-row">
          <span className="muted small">본문 description</span>
          <code>단축어 입력 (메시지 내용)</code>
        </li>
      </ul>
      <p className="muted small">date와 amount는 자리만 채우는 값이에요. 진짜 날짜와 금액은 앱이 문자에서 읽어요.</p>
    </details>
  )
}

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

      {mode === 'shared' && <SmsShortcutGuide />}

      <h2>데이터</h2>
      <div className="stack">
        <button onClick={() => exportCsv(ledger)}>전체 내역 CSV로 백업</button>
        {switchUser && <button onClick={switchUser}>사용자 바꾸기 (지금: {user})</button>}
      </div>
    </section>
  )
}
