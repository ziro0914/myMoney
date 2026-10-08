import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 메일 링크 대신 6자리 코드로 로그인한다.
 * 아이폰 홈 화면 앱(PWA)은 메일 링크를 누르면 Safari로 열려 로그인이 앱에 전달되지 않기 때문.
 */
export default function Login({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await client.auth.signInWithOtp({ email: email.trim().toLowerCase() })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await client.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError('코드가 맞지 않거나 만료됐어요. 다시 받아 주세요.')
  }

  return (
    <div className="login">
      <h1>우리집 가계부</h1>
      {!sent ? (
        <form onSubmit={send}>
          <label>
            이메일
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <button className="primary block" disabled={busy}>로그인 코드 받기</button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <p className="muted">{email}로 보낸 6자리 코드를 입력하세요.</p>
          <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
          <button className="primary block" disabled={busy}>로그인</button>
          <button type="button" className="link" onClick={() => setSent(false)}>이메일 다시 입력</button>
        </form>
      )}
      {error && <p className="banner error">{error}</p>}
      <p className="muted small">가족으로 등록된 이메일만 내역을 볼 수 있어요.</p>
    </div>
  )
}
