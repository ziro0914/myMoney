import { useCallback, useEffect, useState } from 'react'
import { categorize } from './categories'
import type { Repo } from './store/repo'
import type { NewTransaction, Rule, Transaction } from './types'

export function matchesKeyword(t: Transaction, keyword: string): boolean {
  return `${t.description} ${t.memo}`.toUpperCase().includes(keyword.toUpperCase())
}

export function useLedger(repo: Repo) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [txs, rs] = await Promise.all([repo.listTransactions(), repo.listRules()])
      setTransactions(txs)
      setRules(rs)
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
