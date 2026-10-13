import { MEMBERS } from '../members'

/** 로그인 대신 누가 쓰는지만 고른다. 주소를 아는 가족만 쓰는 앱이라 비밀번호는 두지 않는다. */
export default function PickUser({ pick }: { pick: (user: string) => void }) {
  return (
    <div className="login">
      <h1>우리집 가계부</h1>
      <p className="muted">누가 쓰나요?</p>
      <div className="stack">
        {MEMBERS.map((m) => (
          <button key={m} className="primary block" onClick={() => pick(m)}>
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}
