import { categorize } from './categories'
import type { NewTransaction, Rule, Transaction } from './types'

export type Cell = string | number | boolean | Date | null | undefined
export type Grid = Cell[][]

export type Field = 'datetime' | 'time' | 'description' | 'amount' | 'withdrawal' | 'deposit' | 'type' | 'balance' | 'memo'

export type ColumnMap = Partial<Record<Field, number>>

export const FIELD_LABELS: Record<Field, string> = {
  datetime: '거래일시',
  time: '거래시간',
  description: '내용(적요)',
  amount: '거래금액',
  withdrawal: '출금액',
  deposit: '입금액',
  type: '거래유형',
  balance: '잔액',
  memo: '메모',
}

// 은행마다 헤더 이름이 조금씩 달라서 띄어쓰기를 지운 뒤 비교한다. 먼저 나온 이름이 우선.
const HEADER_ALIASES: Record<Field, string[]> = {
  datetime: ['거래일시', '거래일자', '거래일', '일시', '날짜', '일자'],
  time: ['거래시간', '시간', '시각'],
  description: ['적요', '거래내용', '내용', '거래처', '받는분', '보낸분', '상대방', '가맹점명', '가맹점', '기재내용'],
  amount: ['거래금액', '금액'],
  withdrawal: ['출금액', '출금금액', '찾으신금액', '출금', '지급액'],
  deposit: ['입금액', '입금금액', '맡기신금액', '입금'],
  type: ['거래유형', '거래구분', '구분', '유형'],
  balance: ['거래후잔액', '잔액'],
  memo: ['메모', '비고'],
}

const normalize = (v: Cell) => String(v ?? '').replace(/\s+/g, '').trim()

/** 한 행을 헤더로 보고 열 위치를 찾는다. */
export function detectColumns(header: Cell[]): ColumnMap {
  const names = header.map(normalize)
  const map: ColumnMap = {}
  const used = new Set<number>()
  for (const field of Object.keys(HEADER_ALIASES) as Field[]) {
    for (const alias of HEADER_ALIASES[field]) {
      const idx = names.findIndex((n, i) => !used.has(i) && n === alias)
      if (idx >= 0) {
        map[field] = idx
        used.add(idx)
        break
      }
    }
  }
  return map
}

function isUsable(map: ColumnMap): boolean {
  return map.datetime !== undefined && (map.amount !== undefined || map.withdrawal !== undefined || map.deposit !== undefined)
}

/** 위쪽 몇 줄(계좌 정보 등)을 건너뛰고 헤더 행을 찾는다. */
export function findHeader(grid: Grid): { headerRow: number; columns: ColumnMap } | null {
  for (let r = 0; r < Math.min(grid.length, 40); r++) {
    const columns = detectColumns(grid[r])
    if (isUsable(columns)) return { headerRow: r, columns }
  }
  return null
}

export function parseAmount(v: Cell): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null
  const s = String(v).replace(/[,\s원₩]/g, '')
  if (!s || s === '-') return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n) : null
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 날짜와(있으면) 시간을 꺼낸다. */
export function parseDateTime(v: Cell): { date: string; time: string } | null {
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    // read-excel-file은 엑셀 날짜를 UTC 기준 Date로 돌려준다.
    const time = v.getUTCHours() || v.getUTCMinutes() ? `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}` : ''
    return { date: `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`, time }
  }
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})일?(?:[T\s]+(\d{1,2}):(\d{2}))?/)
  if (!m) m = s.match(/^(\d{4})(\d{2})(\d{2})(?:\s*(\d{2}):?(\d{2}))?/)
  if (!m) return null
  const [, y, mo, d, h, mi] = m
  const month = Number(mo)
  const day = Number(d)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { date: `${y}-${pad(month)}-${pad(day)}`, time: h ? `${pad(Number(h))}:${mi}` : '' }
}

function parseTime(v: Cell): string {
  if (v instanceof Date) return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`
  const m = String(v ?? '').match(/(\d{1,2}):(\d{2})/)
  return m ? `${pad(Number(m[1]))}:${m[2]}` : ''
}

const OUTGOING_TYPE = /출금|지급|결제|이체출금|송금|인출/

export interface ParsedRow {
  date: string
  time: string
  amount: number
  description: string
  memo: string
  balance: number | null
}

export function parseRows(grid: Grid, headerRow: number, columns: ColumnMap): { rows: ParsedRow[]; skipped: number } {
  const rows: ParsedRow[] = []
  let skipped = 0
  const get = (row: Cell[], f: Field) => (columns[f] === undefined ? undefined : row[columns[f]!])

  for (const row of grid.slice(headerRow + 1)) {
    if (row.every((c) => normalize(c) === '')) continue
    const dt = parseDateTime(get(row, 'datetime'))
    if (!dt) {
      skipped++
      continue
    }
    if (!dt.time && columns.time !== undefined) dt.time = parseTime(get(row, 'time'))

    let amount: number | null = null
    if (columns.amount !== undefined) {
      amount = parseAmount(get(row, 'amount'))
      // 금액이 부호 없이 적혀 있으면 거래유형으로 방향을 정한다.
      if (amount !== null && amount > 0 && OUTGOING_TYPE.test(String(get(row, 'type') ?? ''))) amount = -amount
    } else {
      const out = parseAmount(get(row, 'withdrawal')) ?? 0
      const inc = parseAmount(get(row, 'deposit')) ?? 0
      amount = out || inc ? inc - Math.abs(out) : null
    }
    if (amount === null || amount === 0) {
      skipped++
      continue
    }

    rows.push({
      ...dt,
      amount,
      description: String(get(row, 'description') ?? '').trim(),
      memo: String(get(row, 'memo') ?? '').trim(),
      balance: parseAmount(get(row, 'balance')),
    })
  }
  return { rows, skipped }
}

/**
 * 같은 내역을 두 번 가져와도 한 번만 저장되도록 키를 만든다.
 * 한 파일 안에서 완전히 같은 거래가 여러 번 있으면 순번을 붙여 구분한다.
 */
export function withDedupeKeys(rows: ParsedRow[]): (ParsedRow & { dedupeKey: string })[] {
  const seen = new Map<string, number>()
  return rows.map((r) => {
    const base = [r.date, r.time, r.amount, r.description, r.balance ?? ''].join('|')
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return { ...r, dedupeKey: `${base}#${n}` }
  })
}

export function toTransactions(rows: ParsedRow[], rules: Rule[]): NewTransaction[] {
  return withDedupeKeys(rows).map((r) => ({
    date: r.date,
    time: r.time,
    amount: r.amount,
    description: r.description,
    memo: r.memo,
    balance: r.balance,
    category: categorize(`${r.description} ${r.memo}`, r.amount, rules),
    source: 'import',
    dedupeKey: r.dedupeKey,
  }))
}

/**
 * 이미 저장된 내역과 같은 거래로 보이는 것을 찾는다 (돌려주는 값은 newTxs의 인덱스).
 * 파일과 캡처는 내용 칸이 다르게 적힐 수 있어서 날짜·금액이 같고, 시간·잔액은 둘 다 있을 때만 비교한다.
 * 저장된 내역 하나는 새 내역 하나와만 짝지어서, 정말 같은 거래가 두 번 있으면 하나는 새 내역으로 남는다.
 */
export function findExisting(newTxs: NewTransaction[], existing: Transaction[]): Set<number> {
  const byDay = new Map<string, Transaction[]>()
  for (const t of existing) {
    const k = `${t.date}|${t.amount}`
    byDay.set(k, [...(byDay.get(k) ?? []), t])
  }
  const used = new Set<string>()
  const dup = new Set<number>()
  newTxs.forEach((n, i) => {
    const match = (byDay.get(`${n.date}|${n.amount}`) ?? []).find(
      (t) =>
        !used.has(t.id) &&
        (t.dedupeKey === n.dedupeKey ||
          ((!t.time || !n.time || t.time === n.time) && (t.balance === null || n.balance === null || t.balance === n.balance))),
    )
    if (match) {
      used.add(match.id)
      dup.add(i)
    }
  })
  return dup
}

/** 따옴표로 감싼 칸과 칸 안의 쉼표·줄바꿈을 처리하는 CSV 파서 */
export function parseCsv(text: string): Grid {
  const grid: Grid = []
  let row: Cell[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      grid.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    grid.push(row)
  }
  return grid
}

/** 국내 은행 CSV는 EUC-KR인 경우가 많아서 UTF-8로 안 읽히면 EUC-KR로 다시 읽는다. */
export function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return new TextDecoder('euc-kr').decode(buf)
  }
}

export async function readGrids(file: File): Promise<{ name: string; grid: Grid }[]> {
  if (/\.csv$/i.test(file.name)) {
    return [{ name: file.name, grid: parseCsv(decodeText(await file.arrayBuffer())) }]
  }
  if (/\.xls$/i.test(file.name)) {
    throw new Error('예전 엑셀 형식(.xls)은 읽을 수 없어요. 엑셀이나 Numbers에서 .xlsx 또는 .csv로 다시 저장해 주세요.')
  }
  const { default: readXlsxFile } = await import('read-excel-file/browser')
  const sheets = await readXlsxFile(file)
  return sheets.map((s) => ({ name: s.sheet, grid: s.data as unknown as Grid }))
}
