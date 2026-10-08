import type { NewTransaction, Rule, Transaction } from '../types'
import type { Repo } from './repo'

const TX_KEY = 'ledger.transactions'
const RULE_KEY = 'ledger.rules'

function load<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}

function save<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items))
}

export function createLocalRepo(): Repo {
  return {
    mode: 'local',
    async listTransactions() {
      return load<Transaction>(TX_KEY)
    },
    async addTransactions(txs) {
      const all = load<Transaction>(TX_KEY)
      const keys = new Set(all.map((t) => t.dedupeKey).filter(Boolean))
      const added = txs
        .filter((t) => !t.dedupeKey || !keys.has(t.dedupeKey))
        .map((t) => ({ ...t, id: crypto.randomUUID() }))
      save(TX_KEY, [...all, ...added])
      return added
    },
    async updateTransactions(ids, patch: Partial<NewTransaction>) {
      const set = new Set(ids)
      save(TX_KEY, load<Transaction>(TX_KEY).map((t) => (set.has(t.id) ? { ...t, ...patch } : t)))
    },
    async deleteTransaction(id) {
      save(TX_KEY, load<Transaction>(TX_KEY).filter((t) => t.id !== id))
    },
    async listRules() {
      return load<Rule>(RULE_KEY)
    },
    async saveRule(keyword, category) {
      const rules = load<Rule>(RULE_KEY).filter((r) => r.keyword !== keyword)
      save(RULE_KEY, [...rules, { id: crypto.randomUUID(), keyword, category }])
    },
    async deleteRule(id) {
      save(RULE_KEY, load<Rule>(RULE_KEY).filter((r) => r.id !== id))
    },
  }
}
