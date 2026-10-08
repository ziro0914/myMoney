export interface Transaction {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** HH:mm, 가져온 파일에 시간이 없으면 빈 문자열 */
  time: string
  /** 수입은 양수, 지출은 음수 (원 단위) */
  amount: number
  description: string
  category: string
  memo: string
  source: 'import' | 'manual'
  /** 가져오기 중복 방지 키. 직접 입력한 내역은 null */
  dedupeKey: string | null
  balance: number | null
}

export type NewTransaction = Omit<Transaction, 'id'>

export interface Rule {
  id: string
  keyword: string
  category: string
}
