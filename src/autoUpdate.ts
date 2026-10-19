// 홈 화면 앱(아이폰)은 닫지 않으면 예전 버전이 계속 떠 있다.
// 앱으로 돌아올 때마다 새 버전이 배포됐는지 보고, 바뀌었으면 새로 불러온다.

function currentScript(): string | null {
  return document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src') ?? null
}

async function checkForUpdate() {
  const mine = currentScript()
  if (!mine) return
  try {
    const res = await fetch(`./index.html?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const latest = new DOMParser().parseFromString(await res.text(), 'text/html').querySelector('script[type="module"][src]')?.getAttribute('src')
    if (latest && latest !== mine) location.reload()
  } catch {
    // 오프라인이면 다음에 다시 확인한다.
  }
}

export function startAutoUpdate() {
  // 개발 서버에서는 하지 않는다.
  if (import.meta.env.DEV) return
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate()
  })
  void checkForUpdate()
}
