import { monthLabel, shiftMonth } from '../format'

export default function MonthPicker({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  return (
    <div className="month-picker">
      <button aria-label="이전 달" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
      <h1>{monthLabel(month)}</h1>
      <button aria-label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
    </div>
  )
}
