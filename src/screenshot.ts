import { supabase } from './store/supabase'
import type { ParsedRow } from './importer'

interface ScreenshotRow {
  month: number | null
  day: number | null
  time: string
  title: string
  subtitle: string
  amount: number
  balance: number | null
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 캡처에는 연도가 없어서, 오늘보다 미래가 되면 작년으로 본다. */
export function resolveDate(month: number, day: number, today: Date): string {
  let year = today.getFullYear()
  if (month > today.getMonth() + 1 || (month === today.getMonth() + 1 && day > today.getDate())) year--
  return `${year}-${pad(month)}-${pad(day)}`
}

export function toParsedRows(rows: ScreenshotRow[], today: Date, fallbackDate: string | null): ParsedRow[] {
  return rows
    .filter((r) => r.amount !== 0)
    .map((r) => ({
      // 날짜를 못 읽은 줄은 앞 조각의 마지막 날짜(없으면 오늘)로 두고, 확인 화면에서 고치게 한다.
      date: r.month && r.day ? resolveDate(r.month, r.day, today) : (fallbackDate ?? resolveDate(today.getMonth() + 1, today.getDate(), today)),
      time: /^\d{1,2}:\d{2}$/.test(r.time) ? r.time.padStart(5, '0') : '',
      amount: r.amount,
      description: r.title.trim(),
      memo: r.subtitle.trim(),
      balance: r.balance,
    }))
}

/**
 * 여러 캡처가 겹치면 같은 거래가 두 번 나온다. 잔액까지 같으면 같은 거래로 보고 하나만 남긴다.
 * (잔액이 없는 줄은 정말 같은 거래가 두 번일 수 있어 그대로 둔다.)
 */
export function mergeOverlaps(rows: ParsedRow[]): ParsedRow[] {
  const seen = new Set<string>()
  return rows.filter((r) => {
    if (r.balance === null) return true
    const key = [r.date, r.time, r.amount, r.balance].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const MAX_WIDTH = 1000
/** 이보다 세로로 긴 캡처(스크롤 캡처)는 글자가 뭉개지지 않게 조각낸다. */
const MAX_ASPECT = 2.2

/** 캡처를 줄이고 긴 화면은 위에서부터 겹치게 잘라 JPEG(base64)로 만든다. */
export async function prepareImage(file: File): Promise<string[]> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_WIDTH / bitmap.width)
  const width = Math.round(bitmap.width * scale)
  const fullHeight = Math.round(bitmap.height * scale)
  const sliceHeight = Math.round(width * 2)
  const step = Math.round(sliceHeight * 0.85)
  const tops: number[] = []
  if (fullHeight / width <= MAX_ASPECT) tops.push(0)
  else for (let top = 0; ; top += step) {
    tops.push(Math.min(top, fullHeight - sliceHeight))
    if (top + sliceHeight >= fullHeight) break
  }
  return tops.map((top) => {
    const h = tops.length === 1 ? fullHeight : sliceHeight
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, h)
    ctx.drawImage(bitmap, 0, top / scale, bitmap.width, h / scale, 0, 0, width, h)
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
  })
}

function dateLabel(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${m}월 ${d}일`
}

/** 캡처 여러 장을 순서대로 읽는다. 앞 화면의 마지막 날짜를 다음 화면에 넘겨 날짜 헤더가 잘린 경우를 메운다. */
export async function readScreenshots(files: File[], onProgress: (done: number, total: number) => void): Promise<ParsedRow[]> {
  const images = (await Promise.all(files.map(prepareImage))).flat()
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : undefined
  const today = new Date()
  const all: ParsedRow[] = []
  let lastDate: string | null = null
  for (const [i, image] of images.entries()) {
    onProgress(i, images.length)
    const res = await fetch('/api/parse-screenshot', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ image, mediaType: 'image/jpeg', previousDate: lastDate && dateLabel(lastDate) }),
    })
    const body = await res.json().catch(() => ({ error: `서버 오류 (${res.status})` }))
    if (!res.ok) throw new Error(body.error ?? `서버 오류 (${res.status})`)
    const rows = toParsedRows(body.rows as ScreenshotRow[], today, lastDate)
    all.push(...rows)
    if (rows.length) lastDate = rows[rows.length - 1].date
  }
  onProgress(images.length, images.length)
  return mergeOverlaps(all)
}
