import { useCallback, useEffect, useState } from 'react'
import { categorize } from './categories'
import { planSmsInbox, SMS_INBOX_CATEGORY } from './smsInbox'
import type { Repo } from './store/repo'
import type { Budget, NewTransaction, Rule, Transaction } from './types'

export function matchesKeyword(t: Transaction, keyword: string): boolean {
  return `${t.description} ${t.memo}`.toUpperCase().includes(keyword.toUpperCase())
}

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useLedger(repo: Repo) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      let [txs, rs, bs] = await Promise.all([repo.listTransactions(), repo.listRules(), repo.listBudgets()])
      // 단축어로 들어온 카드 문자가 있으면 지출로 바꾸고 다시 읽는다.
      if (txs.some((t) => t.category === SMS_INBOX_CATEGORY)) {
        const plan = planSmsInbox(txs, rs, localToday())
        for (const { id, patch } of plan.updates) await repo.updateTransactions([id], patch)
        for (const id of plan.deletes) await repo.deleteTransaction(id)
        txs = await repo.listTransactions()
      }
      setTransactions(txs)
      setRules(rs)
      setBudgets(bs)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [repo])

  useEffect(() => {
    void reload()
  }, [reload])

  // 실패하면 메시지를 보여주고, 성공하든 실패하든 서버 상태로 다시 맞춘다.
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await fn()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return undefined
      } finally {
        await reload()
      }
    },
    [reload],
  )

  return {
    transactions,
    rules,
    budgets,
    loading,
    error,
    clearError: () => setError(null),
    reload,
    addTransactions: (txs: NewTransaction[]) => run(() => repo.addTransactions(txs)),
    updateTransaction: (id: string, patch: Partial<NewTransaction>) => run(() => repo.updateTransactions([id], patch)),
    deleteTransaction: (id: string) => run(() => repo.deleteTransaction(id)),
    /** 내용이나 메모에 키워드가 들어간 내역을 앞으로 이 분류로 넣고, 이미 있는 내역도 바꾼다. */
    learnCategory: (keyword: string, category: string) =>
      run(async () => {
        await repo.saveRule(keyword, category)
        const ids = transactions.filter((t) => t.category !== category && matchesKeyword(t, keyword)).map((t) => t.id)
        await repo.updateTransactions(ids, { category })
      }),
    saveRule: (keyword: string, category: string) => run(() => repo.saveRule(keyword, category)),
    deleteRule: (id: string) => run(() => repo.deleteRule(id)),
    saveBudgets: (bs: Budget[]) => run(() => repo.saveBudgets(bs)),
    /** 미분류·기타수입 내역에 지금 규칙을 다시 적용한다. 바뀐 건수를 돌려준다. */
    reapplyRules: () =>
      run(async () => {
        const changes = new Map<string, string[]>()
        for (const t of transactions) {
          if (t.category !== '미분류' && t.category !== '기타수입') continue
          const next = categorize(`${t.description} ${t.memo}`, t.amount, rules)
          if (next !== t.category) changes.set(next, [...(changes.get(next) ?? []), t.id])
        }
        for (const [category, ids] of changes) await repo.updateTransactions(ids, { category })
        return [...changes.values()].reduce((n, ids) => n + ids.length, 0)
      }),
  }
}

export type Ledger = ReturnType<typeof useLedger>
