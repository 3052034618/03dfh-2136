import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import { Session, Script, SCRIPT_TYPE_LABELS, MatchOption } from '../types'
import { generateMatchOptions } from '../utils/matcher'
import { PlayerCard } from './common/PlayerCard'

const STATUS_LABELS: Record<Session['status'], string> = {
  pending: '待凑桌',
  matched: '已匹配',
  confirmed: '已确认',
  playing: '进行中',
  ended: '已结束',
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function countStars(n: number) {
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function SessionCard({
  session, script, onMatch, currentOption,
}: {
  session: Session
  script: Script
  onMatch: () => void
  currentOption: MatchOption[] | undefined
}) {
  const bookedCount = session.bookedPlayers.reduce((s, p) => s + p.count, 0)
  const gap = script.minPlayers - bookedCount
  const gapToBest = script.bestPlayers - bookedCount
  const hasUrgent = session.startTime - Date.now() < 30 * 60000 && session.status === 'pending'
  let gapClass = ''
  let gapText = `${gap > 0 ? `缺${gap}` : gapToBest > 0 ? `补${gapToBest}满` : '已满'}`
  if (gap > 0) gapClass = ''
  else if (gapToBest > 0) gapClass = 'ideal'
  else gapClass = 'ideal'

  return (
    <div className={`session-card ${session.status !== 'pending' ? 'matched' : ''} ${hasUrgent ? 'urgent' : ''}`}>
      <div className="session-header">
        <div>
          <div className="session-script-name">
            {script.name}
            <span className={`session-type-badge type-${script.type}`}>{SCRIPT_TYPE_LABELS[script.type]}</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-dim)' }}>
            {session.roomName} · DM {session.dmName} · ⏰ {formatTime(session.startTime)}
            {hasUrgent && <span style={{ marginLeft: 8, color: 'var(--danger)', fontWeight: 600 }}>⚠️ 即将开场</span>}
          </div>
        </div>
        <div>
          <div className={`gap-num ${gapClass}`}>{gap <= 0 ? (gapToBest <= 0 ? '✓' : '优') : gap}</div>
          <div style={{ textAlign: 'center', fontSize: 11, marginTop: 4, color: 'var(--text-dim)' }}>{gapText}</div>
        </div>
      </div>

      <div className="session-meta">
        <div>人数：<span className="val">{bookedCount}/{script.minPlayers}-{script.bestPlayers}/{script.maxPlayers}</span></div>
        <div>时长：<span className="val">{script.durationHours}h</span></div>
        <div>难度：<span className="difficulty-stars">{countStars(script.difficulty)}</span></div>
        <div>价格：<span className="val">¥{script.price}/人</span></div>
      </div>

      {session.bookedPlayers.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>
            已入 {session.bookedPlayers.length} 组（{bookedCount}人）：
          </div>
          <div className="matched-players">
            {session.bookedPlayers.map(p => (
              <span key={p.id} className="matched-player-chip">
                {p.name} · {p.count}人
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className={`session-status status-${session.status}`}>{STATUS_LABELS[session.status]}</span>
        {session.status === 'pending' && (
          <button className="btn btn-primary btn-sm" onClick={onMatch}>
            🔍 智能凑桌{currentOption && currentOption.length > 0 ? ` (${currentOption.length})` : ''}
          </button>
        )}
        {(session.status === 'confirmed' || session.status === 'matched') && (
          <span style={{ fontSize: 12, color: 'var(--success)' }}>✓ 已安排</span>
        )}
      </div>
    </div>
  )
}

function MatchResults({
  session, script, onBack, onChoose, selectedId,
}: {
  session: Session
  script: Script
  options: MatchOption[]
  onBack: () => void
  onChoose: (optionId: string) => void
  selectedId: string | null
}) {
  const { matchOptions } = useApp()
  const options = matchOptions[session.id] ?? []

  return (
    <div>
      <div className="script-info-big">
        <div>
          <div className="name">
            {script.name}
            <span className={`session-type-badge type-${script.type}`} style={{ marginLeft: 12 }}>
              {SCRIPT_TYPE_LABELS[script.type]}
            </span>
          </div>
          <div className="details">
            <span>人数：<strong>{script.minPlayers}-{script.bestPlayers}/{script.maxPlayers} 人</strong></span>
            <span>时长：<strong>{script.durationHours} 小时</strong></span>
            <span>难度：<strong className="difficulty-stars">{countStars(script.difficulty)}</strong></span>
            <span>价格：<strong>¥{script.price} / 人</strong></span>
            <span>房间：<strong>{session.roomName}</strong></span>
            <span>DM：<strong>{session.dmName}</strong></span>
            <span>开场：<strong>{formatTime(session.startTime)}</strong></span>
          </div>
        </div>
        <div className={`big-gap ${script.minPlayers - session.bookedPlayers.reduce((s, p) => s + p.count, 0) <= 0 ? 'ready' : 'need'}`}>
          <div className="num">{Math.max(0, script.minPlayers - session.bookedPlayers.reduce((s, p) => s + p.count, 0))}</div>
          <div className="lbl">当前缺口</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16 }}>🎯 智能匹配方案（{options.length}）</h2>
        <button className="btn btn-ghost" onClick={onBack}>← 返回场次列表</button>
      </div>

      {options.length === 0 ? (
        <div className="empty-state">
          <div className="icon">😅</div>
          <div className="text" style={{ marginBottom: 8 }}>候补池人数暂时凑不出这局...</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            可以尝试：继续等散客到店 / 调整开场时间 / 询问玩家是否可换本
          </div>
        </div>
      ) : (
        <div>
          {options.map((opt, idx) => (
            <div
              key={opt.id}
              className={`match-option ${selectedId === opt.id ? 'selected' : ''}`}
              onClick={() => onChoose(opt.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <strong style={{ fontSize: 16 }}>方案 {idx + 1}</strong>
                  <span className="player-count">{opt.totalCount} 人</span>
                  {opt.totalCount === script.bestPlayers && (
                    <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>✨ 最佳人数</span>
                  )}
                  <span className="match-score">匹配度 {Math.max(0, Math.round(opt.score))}</span>
                </div>
                {selectedId === opt.id && (
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>✓ 已选择</span>
                )}
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>
                包含 {opt.players.length} 组玩家：
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {opt.players.map(p => (
                  <PlayerCard key={p.id} player={p} showActions={false} />
                ))}
              </div>

              {opt.conflicts.length > 0 && (
                <div className="conflicts-list">
                  {opt.conflicts.map((c, i) => (
                    <div key={i} className={`conflict-item ${c.severity}`}>
                      <span className="conflict-icon">{c.severity === 'block' ? '🛑' : '⚠️'}</span>
                      <span>{c.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TodaySessions() {
  const { sessions, scripts, players, setMatchOptions, setSelectedMatch, selectedMatch } = useApp()
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null)
  const [showAddSession, setShowAddSession] = useState(false)
  const [newSession, setNewSession] = useState({
    scriptId: '',
    startTime: Math.floor((Date.now() + 30 * 60000) / 60000) * 60000,
    roomName: '',
    dmName: '',
  })

  const sessionMap = useMemo(() => {
    const m = new Map<string, Script>()
    for (const s of scripts) m.set(s.id, s)
    return m
  }, [scripts])

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.startTime - b.startTime),
    [sessions]
  )

  const handleMatch = (session: Session) => {
    const script = sessionMap.get(session.scriptId)
    if (!script) return
    const existingBooked = session.bookedPlayers
    const usedIds = new Set(existingBooked.map(p => p.id))
    const availablePlayers = players.filter(p => !usedIds.has(p.id))
    const opts = generateMatchOptions(session, script, [...existingBooked, ...availablePlayers])
    setMatchOptions(session.id, opts)
    setViewingSessionId(session.id)
    setSelectedMatch(null)
  }

  const handleChoose = (optionId: string) => {
    if (!viewingSessionId) return
    setSelectedMatch(viewingSessionId, optionId)
  }

  const pendingCount = sessions.filter(s => s.status === 'pending').length
  const urgentCount = sessions.filter(
    s => s.status === 'pending' && s.startTime - Date.now() < 30 * 60000
  ).length
  const confirmedCount = sessions.filter(s => s.status === 'confirmed' || s.status === 'matched').length

  if (viewingSessionId) {
    const session = sessions.find(s => s.id === viewingSessionId)
    const script = session && sessionMap.get(session.scriptId)
    if (session && script) {
      return (
        <div>
          <MatchResults
            session={session}
            script={script}
            options={[]}
            onBack={() => setViewingSessionId(null)}
            onChoose={handleChoose}
            selectedId={selectedMatch?.sessionId === session.id ? selectedMatch.optionId : null}
          />
          {selectedMatch?.sessionId === session.id && (
            <div style={{ position: 'sticky', bottom: 16, marginTop: 20, textAlign: 'right', zIndex: 10 }}>
              <div style={{ display: 'inline-flex', gap: 10, background: 'var(--panel)', padding: 12, borderRadius: 10, border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
                <button className="btn btn-ghost" onClick={() => setSelectedMatch(null)}>取消选择</button>
                <button
                  className="btn btn-success btn-lg"
                  onClick={() => {
                    sessionStorage.setItem('pending_confirm_session', session.id)
                    document.dispatchEvent(new CustomEvent('navigate', { detail: 'confirm' }))
                  }}
                >
                  → 进入成桌核对
                </button>
              </div>
            </div>
          )}
        </div>
      )
    }
  }

  const { addSession } = useApp()

  const submitSession = () => {
    if (!newSession.scriptId || !newSession.roomName || !newSession.dmName) return
    addSession({
      scriptId: newSession.scriptId,
      startTime: newSession.startTime,
      roomName: newSession.roomName.trim(),
      dmName: newSession.dmName.trim(),
      status: 'pending',
      bookedPlayers: [],
    })
    setShowAddSession(false)
    setNewSession({
      scriptId: scripts[0]?.id ?? '',
      startTime: Math.floor((Date.now() + 30 * 60000) / 60000) * 60000,
      roomName: '',
      dmName: '',
    })
  }

  const minDateStr = (() => {
    const d = new Date(newSession.startTime)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  })()

  return (
    <div>
      <div className="stats-bar">
        <div className="stat-card warning">
          <div className="stat-num">{pendingCount}</div>
          <div className="stat-label">待凑桌场次</div>
        </div>
        <div className={`stat-card ${urgentCount > 0 ? 'danger' : ''}`}>
          <div className="stat-num">{urgentCount}</div>
          <div className="stat-label">30分钟内开场</div>
        </div>
        <div className="stat-card success">
          <div className="stat-num">{confirmedCount}</div>
          <div className="stat-label">已安排</div>
        </div>
        <div className="stat-card primary">
          <div className="stat-num">{players.length}</div>
          <div className="stat-label">可匹配候补中</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <span>📅 今日场次（按开场时间排序）</span>
          <div className="actions">
            <button className="btn" onClick={() => setShowAddSession(v => !v)}>
              {showAddSession ? '取消' : '➕ 加开场次'}
            </button>
          </div>
        </div>

        {showAddSession && (
          <div style={{ marginBottom: 16, padding: 14, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div className="form-row-3">
              <div className="form-group">
                <label>选择剧本</label>
                <select
                  className="form-control"
                  value={newSession.scriptId}
                  onChange={e => setNewSession(s => ({ ...s, scriptId: e.target.value }))}
                >
                  <option value="">请选择...</option>
                  {scripts.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.minPlayers}-{s.bestPlayers}人 · {s.durationHours}h · ¥{s.price})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>开场时间</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={(() => {
                    const d = new Date(newSession.startTime)
                    const pad = (n: number) => String(n).padStart(2, '0')
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
                  })()}
                  onChange={e => setNewSession(s => ({ ...s, startTime: new Date(e.target.value).getTime() }))}
                />
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>当前值：{minDateStr}</div>
              </div>
              <div className="form-group">
                <label>房间名</label>
                <input
                  className="form-control"
                  placeholder="例：一号厅、VIP厅"
                  value={newSession.roomName}
                  onChange={e => setNewSession(s => ({ ...s, roomName: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>DM 姓名</label>
                <input
                  className="form-control"
                  placeholder="例：DM-小白"
                  value={newSession.dmName}
                  onChange={e => setNewSession(s => ({ ...s, dmName: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ justifyContent: 'flex-end', flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                <button className="btn" onClick={() => setShowAddSession(false)}>取消</button>
                <button className="btn btn-primary" onClick={submitSession}>✓ 创建场次</button>
              </div>
            </div>
          </div>
        )}

        {sortedSessions.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📋</div>
            <div className="text">还没有场次，点击上方「加开场次」开始</div>
          </div>
        ) : (
          <div className="grid-list">
            {sortedSessions.map(s => {
              const script = sessionMap.get(s.scriptId)
              if (!script) return null
              return (
                <SessionCard
                  key={s.id}
                  session={s}
                  script={script}
                  onMatch={() => handleMatch(s)}
                  currentOption={undefined}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
