import type { NewTransaction, Rule, Transaction } from '../types'

export interface Repo {
  /** 'local'은 이 기기 브라우저에만, 'shared'는 Supabase에 저장해서 가족이 함께 본다. */
  readonly mode: 'local' | 'shared'
  listTransactions(): Promise<Transaction[]>
  /** dedupeKey가 이미 있는 내역은 건너뛰고, 실제로 추가된 내역을 돌려준다. */
  addTransactions(txs: NewTransaction[]): Promise<Transaction[]>
  updateTransactions(ids: string[], patch: Partial<NewTransaction>): Promise<void>
  deleteTransaction(id: string): Promise<void>
  listRules(): Promise<Rule[]>
  /** 같은 키워드 규칙이 있으면 분류만 바꾼다. */
  saveRule(keyword: string, category: string): Promise<void>
  deleteRule(id: string): Promise<void>
}
