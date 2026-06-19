import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Player, Script, Session, MatchOption } from '../types'
import { DEFAULT_PLAYERS, DEFAULT_SCRIPTS, DEFAULT_SESSIONS } from '../data/mockData'

interface AppState {
  players: Player[]
  scripts: Script[]
  sessions: Session[]
  matchOptions: Record<string, MatchOption[]>
  selectedMatch: { sessionId: string; optionId: string } | null
}

interface AppContextType extends AppState {
  addPlayer: (p: Omit<Player, 'id' | 'arrivalTime'>) => void
  removePlayer: (id: string) => void
  updatePlayer: (id: string, p: Partial<Player>) => void
  addScript: (s: Omit<Script, 'id'>) => void
  removeScript: (id: string) => void
  addSession: (s: Omit<Session, 'id'>) => void
  updateSession: (id: string, s: Partial<Session>) => void
  removeSession: (id: string) => void
  setMatchOptions: (sessionId: string, options: MatchOption[]) => void
  setSelectedMatch: (sessionId: string | null, optionId?: string) => void
  confirmSession: (sessionId: string) => void
  resetAll: () => void
}

const AppContext = createContext<AppContextType | null>(null)

const STORAGE_KEY = 'jubensha_matcher_state_v2'

function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const state: AppState = JSON.parse(raw)
      state.players = state.players.map(p => ({
        ...p,
        source: p.source ?? 'walkin',
        status: p.status ?? 'waiting',
      }))
      return state
    }
  } catch {}
  return null
}

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function AppProvider({ children }: { children: ReactNode }) {
  const saved = loadState()
  const [state, setState] = useState<AppState>(
    saved ?? {
      players: DEFAULT_PLAYERS,
      scripts: DEFAULT_SCRIPTS,
      sessions: DEFAULT_SESSIONS,
      matchOptions: {},
      selectedMatch: null,
    }
  )

  useEffect(() => {
    saveState(state)
  }, [state])

  const addPlayer = (p: Omit<Player, 'id' | 'arrivalTime'>) => {
    setState(s => ({
      ...s,
      players: [...s.players, { ...p, id: uid(), arrivalTime: Date.now() }],
    }))
  }

  const removePlayer = (id: string) => {
    setState(s => ({ ...s, players: s.players.filter(p => p.id !== id) }))
  }

  const updatePlayer = (id: string, p: Partial<Player>) => {
    setState(s => ({
      ...s,
      players: s.players.map(pl => (pl.id === id ? { ...pl, ...p } : pl)),
    }))
  }

  const addScript = (s: Omit<Script, 'id'>) => {
    setState(st => ({ ...st, scripts: [...st.scripts, { ...s, id: uid() }] }))
  }

  const removeScript = (id: string) => {
    setState(s => ({ ...s, scripts: s.scripts.filter(sc => sc.id !== id) }))
  }

  const addSession = (s: Omit<Session, 'id'>) => {
    setState(st => ({ ...st, sessions: [...st.sessions, { ...s, id: uid() }] }))
  }

  const updateSession = (id: string, s: Partial<Session>) => {
    setState(st => ({
      ...st,
      sessions: st.sessions.map(se => (se.id === id ? { ...se, ...s } : se)),
    }))
  }

  const removeSession = (id: string) => {
    setState(s => ({ ...s, sessions: s.sessions.filter(se => se.id !== id) }))
  }

  const setMatchOptions = (sessionId: string, options: MatchOption[]) => {
    setState(s => ({
      ...s,
      matchOptions: { ...s.matchOptions, [sessionId]: options },
    }))
  }

  const setSelectedMatch = (sessionId: string | null, optionId?: string) => {
    setState(s => ({
      ...s,
      selectedMatch:
        sessionId && optionId ? { sessionId, optionId } : null,
    }))
  }

  const confirmSession = (sessionId: string) => {
    setState(st => {
      const options = st.matchOptions[sessionId]
      const sel = st.selectedMatch
      const option = options?.find(o => o.id === sel?.optionId && o.sessionId === sessionId)
      if (!option) return st
      const usedIds = new Set(option.players.map(p => p.id))
      return {
        ...st,
        sessions: st.sessions.map(se =>
          se.id === sessionId
            ? {
                ...se,
                bookedPlayers: option.players,
                status: 'confirmed',
                confirmed: {
                  scriptName: false,
                  playerCount: false,
                  price: false,
                  startTime: false,
                  carpoolSuccess: false,
                },
              }
            : se
        ),
        players: st.players.filter(p => !usedIds.has(p.id)),
        matchOptions: { ...st.matchOptions, [sessionId]: [] },
        selectedMatch: null,
      }
    })
  }

  const resetAll = () => {
    if (confirm('确定要清空所有数据，恢复到初始示例状态吗？')) {
      localStorage.removeItem(STORAGE_KEY)
      setState({
        players: DEFAULT_PLAYERS,
        scripts: DEFAULT_SCRIPTS,
        sessions: DEFAULT_SESSIONS,
        matchOptions: {},
        selectedMatch: null,
      })
    }
  }

  return (
    <AppContext.Provider
      value={{
        ...state,
        addPlayer,
        removePlayer,
        updatePlayer,
        addScript,
        removeScript,
        addSession,
        updateSession,
        removeSession,
        setMatchOptions,
        setSelectedMatch,
        confirmSession,
        resetAll,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
