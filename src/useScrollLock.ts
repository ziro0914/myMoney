import { useEffect } from 'react'

/** 아래에서 올라오는 창이 열려 있는 동안 뒤 화면이 스크롤되지 않게 한다 (아이폰에서 창 대신 뒤 화면이 움직이는 문제). */
export function useScrollLock() {
  useEffect(() => {
    const els = [document.documentElement, document.body]
    const prev = els.map((el) => el.style.overflow)
    els.forEach((el) => (el.style.overflow = 'hidden'))
    return () => els.forEach((el, i) => (el.style.overflow = prev[i]))
  }, [])
}
