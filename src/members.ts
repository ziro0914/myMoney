import { STORAGE_PREFIX } from './book'

// 가계부를 쓰는 사람. 로그인 없이 첫 화면에서 고르면 이 기기에 기억한다.
export const MEMBERS = ['남편', '아내'] as const

const KEY = `${STORAGE_PREFIX}user`

export function getUser(): string | null {
  try {
    const u = localStorage.getItem(KEY)
    return u && (MEMBERS as readonly string[]).includes(u) ? u : null
  } catch {
    return null
  }
}

export function setUser(user: string | null) {
  try {
    if (user) localStorage.setItem(KEY, user)
    else localStorage.removeItem(KEY)
  } catch {
    // 저장이 막힌 브라우저에서는 이번 방문 동안만 기억한다.
  }
}
