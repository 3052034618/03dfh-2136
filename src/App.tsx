import { useEffect, useState } from 'react'
import { useApp } from './store/AppContext'
import TodaySessions from './components/TodaySessions'
import PlayerPool from './components/PlayerPool'
import ConfirmDesk from './components/ConfirmDesk'

type Tab = 'sessions' | 'pool' | 'confirm'

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function App() {
  const [tab, setTab] = useState<Tab>('sessions')
  const { players, sessions, resetAll } = useApp()
  const now = useClock()
  const pad = (n: number) => String(n).padStart(2, '0')

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail === 'confirm') setTab('confirm')
      else if (e.detail === 'sessions') setTab('sessions')
      else if (e.detail === 'pool') setTab('pool')
    }
    document.addEventListener('navigate', handler as any)
    return () => document.removeEventListener('navigate', handler as any)
  }, [])

  const pendingSessionCount = sessions.filter(
    s => s.status === 'pending' && s.startTime - Date.now() < 30 * 60000
  ).length
  const poolCount = players.length
  const toConfirm = sessions.filter(
    s => (s.status === 'confirmed' && s.confirmed && Object.values(s.confirmed).filter(Boolean).length < 5)
  ).length

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <span className="logo">🎭</span>
          剧本杀快速凑桌助手
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
            小店高峰期，减少喊人和改群消息
          </span>
        </h1>
        <div className="header-right">
          <span className="clock">
            📅 {now.getFullYear()}-{pad(now.getMonth() + 1)}-{pad(now.getDate())} · {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
          </span>
          <button className="btn btn-sm btn-ghost" onClick={resetAll} title="清空数据恢复示例">
            🔄 重置数据
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${tab === 'sessions' ? 'active' : ''}`}
          onClick={() => setTab('sessions')}
        >
          📅 场次&调度
          {pendingSessionCount > 0 && <span className="badge">{pendingSessionCount}</span>}
        </button>
        <button
          className={`tab ${tab === 'pool' ? 'active' : ''}`}
          onClick={() => setTab('pool')}
        >
          🎟️ 候补池
          {poolCount > 0 && <span className="badge">{poolCount}</span>}
        </button>
        <button
          className={`tab ${tab === 'confirm' ? 'active' : ''}`}
          onClick={() => setTab('confirm')}
        >
          ✅ 成桌核对
          {toConfirm > 0 && <span className="badge">{toConfirm}</span>}
        </button>
      </nav>

      <main className="main-content">
        {tab === 'sessions' && <TodaySessions />}
        {tab === 'pool' && <PlayerPool />}
        {tab === 'confirm' && <ConfirmDesk />}
      </main>
    </div>
  )
}
