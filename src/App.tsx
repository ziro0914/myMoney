import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { currentMonth } from './format'
import { createLocalRepo } from './store/localRepo'
import { createSupabaseRepo } from './store/supabaseRepo'
import { supabase } from './store/supabase'
import { useLedger } from './useLedger'
import type { Repo } from './store/repo'
import Dashboard from './views/Dashboard'
import ImportView from './views/ImportView'
import Login from './views/Login'
import SettingsView from './views/SettingsView'
import TxList from './views/TxList'

type Tab = 'home' | 'list' | 'import' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: '홈', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z' },
  { id: 'list', label: '내역', icon: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'import', label: '가져오기', icon: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14' },
  { id: 'settings', label: '설정', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.4 1.4m8.6 8.6l1.4 1.4m0-11.4l-1.4 1.4m-8.6 8.6l-1.4 1.4' },
]

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!authReady) return <div className="center muted">불러오는 중…</div>
  if (supabase && !session) return <Login client={supabase} />
  return <Ledger key={session?.user.id ?? 'local'} />
}

function Ledger() {
  const repo: Repo = useMemo(() => (supabase ? createSupabaseRepo(supabase) : createLocalRepo()), [])
  const ledger = useLedger(repo)
  const [tab, setTab] = useState<Tab>('home')
  const [month, setMonth] = useState(currentMonth())
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  return (
    <div className="app">
      <main className="content">
        {ledger.error && (
          <div className="banner error" role="alert">
            {ledger.error}
            <button className="link" onClick={ledger.clearError}>닫기</button>
          </div>
        )}
        {ledger.loading ? (
          <div className="center muted">불러오는 중…</div>
        ) : tab === 'home' ? (
          <Dashboard
            ledger={ledger}
            month={month}
            setMonth={setMonth}
            openCategory={(c) => {
              setCategoryFilter(c)
              setTab('list')
            }}
            goImport={() => setTab('import')}
          />
        ) : tab === 'list' ? (
          <TxList ledger={ledger} month={month} setMonth={setMonth} category={categoryFilter} setCategory={setCategoryFilter} />
        ) : tab === 'import' ? (
          <ImportView ledger={ledger} done={() => setTab('list')} />
        ) : (
          <SettingsView ledger={ledger} mode={repo.mode} />
        )}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={t.icon} />
            </svg>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
