import { useMemo, useState } from 'react'
import { formatWon } from '../format'
import { FIELD_LABELS, findExisting, findHeader, parseRows, readGrids, toTransactions, type ColumnMap, type Field, type Grid } from '../importer'
import type { Ledger } from '../useLedger'
import ScreenshotImport from './ScreenshotImport'

interface Loaded {
  fileName: string
  grid: Grid
  headerRow: number
  columns: ColumnMap
}

const FIELDS = Object.keys(FIELD_LABELS) as Field[]

export default function ImportView({ ledger, done }: { ledger: Ledger; done: () => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    setMessage(null)
    setLoaded(null)
    try {
      const sheets = await readGrids(file)
      for (const { grid } of sheets) {
        const found = findHeader(grid)
        if (found) {
          setLoaded({ fileName: file.name, grid, ...found })
          return
        }
      }
      // 헤더를 못 찾으면 첫 시트의 첫 줄을 헤더로 두고 직접 고르게 한다.
      setLoaded({ fileName: file.name, grid: sheets[0]?.grid ?? [], headerRow: 0, columns: {} })
      setMessage('열 이름을 자동으로 찾지 못했어요. 아래에서 헤더 줄과 열을 직접 골라 주세요.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '파일을 읽지 못했어요.')
    }
  }

  const preview = useMemo(() => {
    if (!loaded) return null
    const { rows, skipped } = parseRows(loaded.grid, loaded.headerRow, loaded.columns)
    const txs = toTransactions(rows, ledger.rules)
    const existing = findExisting(txs, ledger.transactions)
    const fresh = txs.filter((_, i) => !existing.has(i))
    return { txs, fresh, skipped, duplicates: txs.length - fresh.length }
  }, [loaded, ledger.rules, ledger.transactions])

  async function confirmImport() {
    if (!preview) return
    setBusy(true)
    const added = await ledger.addTransactions(preview.fresh)
    setBusy(false)
    if (added) {
      setLoaded(null)
      done()
    }
  }

  const header = loaded?.grid[loaded.headerRow] ?? []

  return (
    <section>
      <h1>거래내역 가져오기</h1>
      <details className="help">
        <summary>토스에서 거래내역 파일 받는 법</summary>
        <ol>
          <li>토스 앱에서 가계부에 넣을 통장을 엽니다.</li>
          <li>거래내역 화면의 메뉴에서 <b>거래내역 내보내기 / 거래내역서 발급</b>을 찾아 엑셀(.xlsx) 또는 CSV로 받습니다.</li>
          <li>메일로 왔다면 아이폰 <b>파일</b> 앱에 저장한 뒤 아래 버튼으로 고르세요.</li>
        </ol>
        <p className="muted small">메뉴 이름은 앱 버전마다 다를 수 있어요. 파일에 비밀번호가 걸려 있으면 엑셀이나 Numbers에서 열어 비밀번호 없이 다시 저장해 주세요.</p>
      </details>

      <label className="file-drop">
        <input type="file" accept=".xlsx,.csv,.xls" onChange={(e) => onFile(e.target.files?.[0])} />
        <span>{loaded ? loaded.fileName : '엑셀 또는 CSV 파일 고르기'}</span>
      </label>
      {!loaded && <ScreenshotImport ledger={ledger} done={done} />}
      {message && <p className="banner">{message}</p>}

      {loaded && preview && (
        <>
          <details className="help" open={Object.keys(loaded.columns).length === 0}>
            <summary>열 맞추기</summary>
            <label>
              헤더 줄
              <select value={loaded.headerRow} onChange={(e) => setLoaded({ ...loaded, headerRow: Number(e.target.value) })}>
                {loaded.grid.slice(0, 40).map((row, i) => (
                  <option key={i} value={i}>
                    {i + 1}줄: {row.filter((c) => c !== null && c !== '').slice(0, 4).map(String).join(', ')}
                  </option>
                ))}
              </select>
            </label>
            <div className="mapping">
              {FIELDS.map((f) => (
                <label key={f}>
                  {FIELD_LABELS[f]}
                  <select
                    value={loaded.columns[f] ?? ''}
                    onChange={(e) => {
                      const columns = { ...loaded.columns }
                      if (e.target.value === '') delete columns[f]
                      else columns[f] = Number(e.target.value)
                      setLoaded({ ...loaded, columns })
                    }}
                  >
                    <option value="">없음</option>
                    {header.map((h, i) => (
                      <option key={i} value={i}>{String(h ?? `${i + 1}번째 열`)}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="muted small">거래금액 하나만 있으면 거래금액을, 출금/입금이 따로 있으면 두 열을 고르세요.</p>
          </details>

          <p>
            <b>{preview.fresh.length}건</b>을 새로 가져옵니다.
            {preview.duplicates > 0 && <span className="muted"> (이미 있는 {preview.duplicates}건 제외)</span>}
            {preview.skipped > 0 && <span className="muted"> (날짜·금액을 읽지 못한 {preview.skipped}줄 제외)</span>}
          </p>
          <ul className="preview">
            {preview.fresh.slice(0, 8).map((t) => (
              <li key={t.dedupeKey}>
                <span className="muted small">{t.date}</span>
                <span className="tx-desc">{t.description}</span>
                <span className="pill">{t.category}</span>
                <span className={t.amount > 0 ? 'income' : ''}>{formatWon(t.amount, true)}</span>
              </li>
            ))}
            {preview.fresh.length > 8 && <li className="muted small">…외 {preview.fresh.length - 8}건</li>}
          </ul>
          <button className="primary block" disabled={busy || preview.fresh.length === 0} onClick={confirmImport}>
            {busy ? '저장 중…' : `${preview.fresh.length}건 가져오기`}
          </button>
        </>
      )}
    </section>
  )
}
