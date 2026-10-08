import type { SupabaseClient } from '@supabase/supabase-js'
import type { NewTransaction, Rule, Transaction } from '../types'
import type { Repo } from './repo'

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
          .from('transactions')
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
          .from('transactions')
          .upsert(txs.slice(i, i + 500).map(toRow), { onConflict: 'dedupe_key', ignoreDuplicates: true })
          .select('*')
        if (error) throw error
        added.push(...(data as TxRow[]).map(fromRow))
      }
      return added
    },
    async updateTransactions(ids, patch) {
      if (!ids.length) return
      const { error } = await db.from('transactions').update(toRow(patch)).in('id', ids)
      if (error) throw error
    },
    async deleteTransaction(id) {
      const { error } = await db.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    async listRules() {
      const { data, error } = await db.from('rules').select('id, keyword, category').order('keyword')
      if (error) throw error
      return data as Rule[]
    },
    async saveRule(keyword, category) {
      const { error } = await db.from('rules').upsert({ keyword, category }, { onConflict: 'keyword' })
      if (error) throw error
    },
    async deleteRule(id) {
      const { error } = await db.from('rules').delete().eq('id', id)
      if (error) throw error
    },
  }
}
