import type { SupabaseClient } from '@supabase/supabase-js'
import type { Budget, NewTransaction, Rule, Transaction } from '../types'
import type { Repo } from './repo'
import { TABLE_PREFIX } from '../book'

const TX = `${TABLE_PREFIX}transactions`
const RULES = `${TABLE_PREFIX}rules`
const BUDGETS = `${TABLE_PREFIX}budgets`

interface TxRow {
  id: string
  date: string
  time: string
  amount: number
  description: string
  category: string
  memo: string
  source: 'import' | 'manual'
  dedupe_key: string | null
  balance: number | null
}

const fromRow = (r: TxRow): Transaction => ({
  id: r.id,
  date: r.date,
  time: r.time,
  amount: Number(r.amount),
  description: r.description,
  category: r.category,
  memo: r.memo,
  source: r.source,
  dedupeKey: r.dedupe_key,
  balance: r.balance === null ? null : Number(r.balance),
})

function toRow(t: Partial<NewTransaction>): Partial<Omit<TxRow, 'id'>> {
  const { dedupeKey, ...rest } = t
  return dedupeKey === undefined ? rest : { ...rest, dedupe_key: dedupeKey }
}

const PAGE = 1000

export function createSupabaseRepo(db: SupabaseClient): Repo {
  return {
    mode: 'shared',
    async listTransactions() {
      // Supabase는 한 번에 최대 1000행까지 돌려주므로 나눠서 받는다.
      const all: Transaction[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db
          .from(TX)
          .select('*')
          .order('date', { ascending: false })
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        all.push(...(data as TxRow[]).map(fromRow))
        if (data.length < PAGE) return all
      }
    },
    async addTransactions(txs) {
      const added: Transaction[] = []
      for (let i = 0; i < txs.length; i += 500) {
        const { data, error } = await db
          .from(TX)
          .upsert(txs.slice(i, i + 500).map(toRow), { onConflict: 'dedupe_key', ignoreDuplicates: true })
          .select('*')
        if (error) throw error
        added.push(...(data as TxRow[]).map(fromRow))
      }
      return added
    },
    async updateTransactions(ids, patch) {
      if (!ids.length) return
      const { error } = await db.from(TX).update(toRow(patch)).in('id', ids)
      if (error) throw error
    },
    async deleteTransaction(id) {
      const { error } = await db.from(TX).delete().eq('id', id)
      if (error) throw error
    },
    async listRules() {
      const { data, error } = await db.from(RULES).select('id, keyword, category').order('keyword')
      if (error) throw error
      return data as Rule[]
    },
    async saveRule(keyword, category) {
      const { error } = await db.from(RULES).upsert({ keyword, category }, { onConflict: 'keyword' })
      if (error) throw error
    },
    async deleteRule(id) {
      const { error } = await db.from(RULES).delete().eq('id', id)
      if (error) throw error
    },
    async listBudgets() {
      const { data, error } = await db.from(BUDGETS).select('month, category, amount')
      if (error) throw error
      return (data as Budget[]).map((b) => ({ ...b, amount: Number(b.amount) }))
    },
    async saveBudgets(budgets) {
      if (!budgets.length) return
      const { error } = await db.from(BUDGETS).upsert(budgets, { onConflict: 'month,category' })
      if (error) throw error
    },
  }
}
