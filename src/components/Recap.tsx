import { useMemo } from 'react'
import { useApp } from '../store/AppContext'
import { SCRIPT_TYPE_LABELS } from '../types'

function formatTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Recap() {
  const { sessions, scripts, updateSession } = useApp()
  const scriptMap = useMemo(() => {
    const m = new Map(scripts.map(s => [s.id, s]))
    return m
  }, [scripts])

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.startTime - b.startTime),
    [sessions]
  )

  const todayStart = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [])

  const todaySessions = sortedSessions.filter(s => s.startTime >= todayStart && s.startTime < todayStart + 24 * 3600 * 1000)

  const totalSessions = todaySessions.length
  const endedCount = todaySessions.filter(s => s.status === 'ended').length
  const playingCount = todaySessions.filter(s => s.status === 'playing').length
  const pendingCount = todaySessions.filter(s => s.status === 'pending' || s.status === 'matched' || s.status === 'confirmed').length

  const totalRevenue = todaySessions.reduce((sum, s) => {
    if (s.status === 'ended' || s.status === 'playing' || s.status === 'confirmed') {
      const script = scriptMap.get(s.scriptId)
      const count = s.bookedPlayers.reduce((a, b) => a + b.count, 0)
      const price = s.handover?.priceOverride ?? script?.price ?? 0
      return sum + count * price
    }
    return sum
  }, 0)

  const switchedCount = todaySessions.filter(s => !!s.switchScriptAt).length
  const exceptionCount = todaySessions.filter(s => (s.handover?.exceptions?.length ?? 0) > 0).length

  const allExceptions = todaySessions.flatMap(s =>
    (s.handover?.exceptions ?? []).map(e => ({ sessionId: s.id, room: s.roomName, script: scriptMap.get(s.scriptId)?.name ?? '-', exception: e }))
  )

  return (
    <div>
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-num">{totalSessions}</div>
          <div className="stat-label">今日总场次</div>
        </div>
        <div className="stat-card success">
          <div className="stat-num">{endedCount}</div>
          <div className="stat-label">已结束</div>
        </div>
        <div className="stat-card primary">
          <div className="stat-num">{playingCount}</div>
          <div className="stat-label">进行中</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-num">{pendingCount}</div>
          <div className="stat-label">待进行</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">¥{totalRevenue}</div>
          <div className="stat-label">已确认收入</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-num">{switchedCount}</div>
          <div className="stat-label">临时换本</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-num">{exceptionCount}</div>
          <div className="stat-label">有异常</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <span>📋 今日场次汇总</span>
        </div>
        {todaySessions.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📭</div>
            <div className="text">今日还没有场次</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>时间</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>房间</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>剧本</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>DM</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>实到/需求</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>收入</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>状态</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11 }}>标记</th>
                </tr>
              </thead>
              <tbody>
                {todaySessions.map(s => {
                  const script = scriptMap.get(s.scriptId)
                  const origScript = s.originalScriptId ? scriptMap.get(s.originalScriptId) : null
                  const count = s.bookedPlayers.reduce((a, b) => a + b.count, 0)
                  const price = s.handover?.priceOverride ?? script?.price ?? 0
                  const revenue = count * price
                  const dmName = s.handover?.dmNameOverride ?? s.dmName
                  const statusColors: Record<string, string> = {
                    pending: 'var(--warning)',
                    matched: 'var(--info)',
                    confirmed: 'var(--success)',
                    playing: 'var(--primary)',
                    ended: 'var(--text-muted)',
                  }
                  const statusLabels: Record<string, string> = {
                    pending: '待凑桌',
                    matched: '待核对',
                    confirmed: '待开本',
                    playing: '进行中',
                    ended: '已结束',
                  }
                  const hasException = (s.handover?.exceptions?.length ?? 0) > 0
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{formatTime(s.startTime)}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 600 }}>{s.roomName}</td>
                      <td style={{ padding: '10px 8px' }}>
                        {origScript ? (
                          <span>
                            <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{origScript.name}</span>
                            <span style={{ color: 'var(--danger)', margin: '0 6px' }}>→</span>
                            <span style={{ fontWeight: 600 }}>{script?.name}</span>
                          </span>
                        ) : (
                          <span>{script?.name}
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{script ? SCRIPT_TYPE_LABELS[script.type] : ''}</span>
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px' }}>{dmName}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ color: count >= (script?.minPlayers ?? 0) ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>{count}</span>
                        <span style={{ color: 'var(--text-muted)' }}>/{script?.minPlayers}-{script?.bestPlayers}</span>
                      </td>
                      <td style={{ padding: '10px 8px', fontWeight: 600 }}>
                        ¥{revenue}
                        {s.handover?.priceOverride && <span style={{ fontSize: 10, color: 'var(--warning)', marginLeft: 6 }}>(改价)</span>}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 4,
                          background: statusColors[s.status] + '22', color: statusColors[s.status],
                        }}>
                          {statusLabels[s.status]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ display: 'inline-flex', gap: 4 }}>
                          {s.switchScriptAt && <span title="临时换本" style={{ fontSize: 12 }}>🔄</span>}
                          {hasException && <span title="有异常记录" style={{ fontSize: 12 }}>⚠️</span>}
                          {s.handover?.notes && <span title="有备注" style={{ fontSize: 12 }}>📝</span>}
                          {!s.switchScriptAt && !hasException && !s.handover?.notes && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {allExceptions.length > 0 && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-title">
            <span>⚠️ 今日异常汇总（{allExceptions.length} 条）</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allExceptions.map((e, i) => (
              <div key={i} style={{
                padding: '10px 12px', borderRadius: 6,
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                fontSize: 13, display: 'flex', gap: 10, alignItems: 'flex-start'
              }}>
                <span>⚠️</span>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    [{e.room}] {e.script}
                  </span>
                  <div style={{ marginTop: 2 }}>{e.exception}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
