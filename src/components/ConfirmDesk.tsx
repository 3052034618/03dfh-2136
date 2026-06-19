import { useMemo, useEffect, useState } from 'react'
import { useApp } from '../store/AppContext'
import { Session, Script, MatchOption, SCRIPT_TYPE_LABELS, PLAYER_TAG_LABELS } from '../types'
import { PlayerCard } from './common/PlayerCard'

function formatTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatFullTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface ConfirmItem {
  key: keyof NonNullable<Session['confirmed']>
  label: string
  renderValue: (ctx: { session: Session; script: Script; option: MatchOption }) => JSX.Element | string
}

export default function ConfirmDesk() {
  const {
    sessions, scripts, matchOptions, selectedMatch, updateSession, confirmSession,
  } = useApp()

  const [autoJumpDone, setAutoJumpDone] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [generatedText, setGeneratedText] = useState<{ title: string; content: string } | null>(null)

  useEffect(() => {
    if (autoJumpDone) return
    const pending = sessionStorage.getItem('pending_confirm_session')
    if (pending) {
      setActiveSessionId(pending)
      sessionStorage.removeItem('pending_confirm_session')
      setAutoJumpDone(true)
    } else if (!autoJumpDone) {
      const first = sessions.find(s => s.status === 'matched' || s.status === 'pending')
      if (first) setActiveSessionId(first.id)
      setAutoJumpDone(true)
    }
  }, [sessions, autoJumpDone])

  const sessionsWithContext = useMemo(() => {
    const scriptMap = new Map(scripts.map(s => [s.id, s]))
    return sessions
      .filter(s => s.status !== 'ended')
      .sort((a, b) => a.startTime - b.startTime)
      .map(s => {
        const script = scriptMap.get(s.scriptId)
        let option: MatchOption | null = null
        if (s.status === 'matched' || s.bookedPlayers.length > 0) {
          option = {
            id: 'confirmed',
            sessionId: s.id,
            players: s.bookedPlayers,
            totalCount: s.bookedPlayers.reduce((a, b) => a + b.count, 0),
            conflicts: [],
            score: 0,
          }
        } else if (selectedMatch?.sessionId === s.id) {
          option = matchOptions[s.id]?.find(o => o.id === selectedMatch.optionId) ?? null
        }
        return { session: s, script, option }
      })
  }, [sessions, scripts, matchOptions, selectedMatch])

  const activeEntry = sessionsWithContext.find(x => x.session.id === activeSessionId)

  const confirmItems: ConfirmItem[] = [
    {
      key: 'scriptName',
      label: '剧本名称',
      renderValue: ({ script }) => <span className="val">{script.name}</span>,
    },
    {
      key: 'playerCount',
      label: '实际人数',
      renderValue: ({ option, script }) => (
        <span className="val">
          {option.totalCount} 人
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 400, marginLeft: 8 }}>
            （剧本范围 {script.minPlayers}-{script.maxPlayers}）
          </span>
        </span>
      ),
    },
    {
      key: 'price',
      label: '人均价格',
      renderValue: ({ script, option }) => (
        <span className="val">
          ¥{script.price} / 人 × {option.totalCount} = ¥{script.price * option.totalCount}
        </span>
      ),
    },
    {
      key: 'startTime',
      label: '开场时间',
      renderValue: ({ session }) => (
        <span className="val">{formatFullTime(session.startTime)}</span>
      ),
    },
    {
      key: 'carpoolSuccess',
      label: '拼车成功确认',
      renderValue: ({ option }) => {
        const hasCarpool = option.players.length > 1
        const groups = option.players.filter(p => p.groupId).length
        const solos = option.players.length - groups
        return (
          <span>
            {hasCarpool ? (
              <span className="val">
                是 — {option.players.length}组拼车
                （{groups > 0 ? `${groups}个团体 + ` : ''}{solos}名单人）
              </span>
            ) : (
              <span className="val">否 — 整包场（{option.players[0]?.groupName || option.players[0]?.name}）</span>
            )}
          </span>
        )
      },
    },
  ]

  const toggleConfirm = (sid: string, key: keyof NonNullable<Session['confirmed']>) => {
    const s = sessions.find(x => x.id === sid)
    if (!s) return
    if (s.status !== 'confirmed') {
      if (!selectedMatch || selectedMatch.sessionId !== sid) return
      confirmSession(sid)
      setTimeout(() => {
        updateSession(sid, { confirmed: { scriptName: false, playerCount: false, price: false, startTime: false, carpoolSuccess: false, [key]: true } })
      }, 50)
    } else {
      const cur = s.confirmed ?? { scriptName: false, playerCount: false, price: false, startTime: false, carpoolSuccess: false }
      updateSession(sid, { confirmed: { ...cur, [key]: !cur[key] } })
    }
  }

  const notifyAndSeat = () => {
    if (!activeEntry?.script || !activeEntry.option) return
    const { session, script, option } = activeEntry
    const messages: string[] = []
    messages.push(`==== 通知话术参考 ====`)
    messages.push(`【${script.name}】${formatTime(session.startTime)}开场，请以下玩家到【${session.roomName}】就坐：`)
    for (const p of option.players) {
      const suffix = p.groupName ? `（${p.groupName}）` : ''
      messages.push(`  · ${p.name}${suffix} — ${p.count}人`)
    }
    messages.push(`请 DM ${session.dmName} 准备发本。`)
    messages.push(``)
    messages.push(`==== 微信群公告可直接复制 ====`)
    messages.push(`📢【${script.name}】${formatTime(session.startTime)}在${session.roomName}开场`)
    messages.push(`DM：${session.dmName} · ${script.durationHours}h · ¥${script.price}/人`)
    messages.push(`入座玩家：${option.players.map(p => `${p.name}(${p.count})`).join('、')}`)
    messages.push(`共${option.totalCount}人，请准时到场~`)
    alert(messages.join('\n'))
  }

  const generateSeatingSlip = () => {
    if (!activeEntry?.script || !activeEntry.option) return
    const { session, script, option } = activeEntry
    const lines: string[] = []
    lines.push('╔══════════════════════════════╗')
    lines.push('║       🎭 玩家入座通知单       ║')
    lines.push('╚══════════════════════════════╝')
    lines.push('')
    lines.push(`剧本：${script.name}（${SCRIPT_TYPE_LABELS[script.type]}）`)
    lines.push(`房间：${session.roomName}`)
    lines.push(`DM：${session.dmName}`)
    lines.push(`开场时间：${formatFullTime(session.startTime)}`)
    lines.push(`预计时长：${script.durationHours} 小时`)
    lines.push(`价格：¥${script.price}/人`)
    lines.push('')
    lines.push('──── 玩家分组 ────')
    option.players.forEach((p, i) => {
      const groupInfo = p.groupName ? ` [${p.groupName}]` : ''
      lines.push(`  ${i + 1}. ${p.name}${groupInfo} — ${p.count}人`)
    })
    lines.push(`  合计：${option.totalCount}人`)
    lines.push('')
    if (option.players.some(p => p.note)) {
      lines.push('──── 注意事项 ────')
      option.players.filter(p => p.note).forEach(p => {
        lines.push(`  ⚠️ ${p.name}: ${p.note}`)
      })
      lines.push('')
    }
    lines.push('请各位玩家准时入座，祝游戏愉快！🎮')
    setGeneratedText({ title: '入座单', content: lines.join('\n') })
  }

  const generateDMChecklist = () => {
    if (!activeEntry?.script || !activeEntry.option) return
    const { session, script, option } = activeEntry
    const lines: string[] = []
    lines.push('╔══════════════════════════════╗')
    lines.push('║     📝 DM 准备清单            ║')
    lines.push('╚══════════════════════════════╝')
    lines.push('')
    lines.push(`剧本：${script.name}`)
    lines.push(`类型：${SCRIPT_TYPE_LABELS[script.type]} · 难度：${'★'.repeat(script.difficulty)}${'☆'.repeat(5 - script.difficulty)}`)
    lines.push(`房间：${session.roomName}`)
    lines.push(`开场：${formatFullTime(session.startTime)}`)
    lines.push(`时长：${script.durationHours}h · 人数：${option.totalCount}人`)
    lines.push(`反串要求：${script.crossGender === 'ok' ? '可反串' : script.crossGender === 'avoid' ? '尽量不反串' : '禁止反串'}`)
    lines.push('')
    lines.push('──── 玩家情况 ────')
    option.players.forEach((p, i) => {
      const groupInfo = p.groupName ? ` [${p.groupName} ${p.count}人]` : ` [${p.count}人]`
      const profLabel = { newbie: '新手', familiar: '熟悉', expert: '老手' }[p.proficiency]
      const tagsStr = p.tags.length > 0 ? ` 标签:${p.tags.map(t => PLAYER_TAG_LABELS[t]).join(',')}` : ''
      lines.push(`  ${i + 1}. ${p.name}${groupInfo} ${profLabel}${tagsStr}`)
    })
    lines.push('')
    if (option.players.some(p => p.note)) {
      lines.push('⚠️ 特殊注意')
      option.players.filter(p => p.note).forEach(p => {
        lines.push(`  · ${p.name}: ${p.note}`)
      })
      lines.push('')
    }
    const newbies = option.players.filter(p => p.proficiency === 'newbie')
    if (newbies.length > 0) {
      lines.push(`💡 含 ${newbies.length} 名新手，请注意扶车讲解`)
    }
    lines.push('')
    lines.push('准备确认：□ 剧本物料 □ 角色卡 □ 道具 □ BGM □ 饮品')
    setGeneratedText({ title: 'DM 准备清单', content: lines.join('\n') })
  }

  const allChecked = (s: Session) => {
    if (!s.confirmed) return false
    return Object.values(s.confirmed).every(Boolean)
  }

  return (
    <div>
      <div className="stats-bar">
        <div className="stat-card primary">
          <div className="stat-num">{sessions.filter(s => s.status === 'confirmed').length}</div>
          <div className="stat-label">核对中场次</div>
        </div>
        <div className="stat-card success">
          <div className="stat-num">{sessions.filter(s => allChecked(s)).length}</div>
          <div className="stat-label">已全部勾选</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-num">{sessions.filter(s => s.status === 'playing').length}</div>
          <div className="stat-label">进行中</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">
            {sessions.reduce((sum, s) => {
              if (s.confirmed && s.confirmed.price && s.bookedPlayers.length > 0) {
                const sc = scripts.find(x => x.id === s.scriptId)
                if (sc) return sum + sc.price * s.bookedPlayers.reduce((a, b) => a + b.count, 0)
              }
              return sum
            }, 0)}
          </div>
          <div className="stat-label">已确认营业额 (¥)</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-title" style={{ fontSize: 14 }}>场次列表</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sessionsWithContext.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 12, textAlign: 'center' }}>
                暂无场次
              </div>
            )}
            {sessionsWithContext.map(({ session, script, option }) => {
              const confirmed = session.confirmed
              const checkedCount = confirmed ? Object.values(confirmed).filter(Boolean).length : 0
              const isActive = activeSessionId === session.id
              return (
                <div
                  key={session.id}
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                    background: isActive ? 'rgba(99,102,241,0.1)' : 'var(--bg-2)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setActiveSessionId(session.id)}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                    {script?.name ?? '未知剧本'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                    ⏰ {formatTime(session.startTime)} · {session.roomName}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {option ? `${option.totalCount}人` : '待匹配'}
                    </span>
                    {session.status === 'confirmed' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{
                          width: 60, height: 5, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${(checkedCount / 5) * 100}%`,
                            height: '100%',
                            background: checkedCount === 5 ? 'var(--success)' : 'var(--primary)',
                          }} />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{checkedCount}/5</span>
                      </div>
                    ) : (
                      <span style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: option ? 'var(--success)' : 'var(--warning)',
                        color: option ? 'white' : '#1f2937',
                      }}>
                        {option ? '可核对' : '待凑桌'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          {!activeEntry || !activeEntry.script || !activeEntry.option ? (
            <div className="panel">
              <div className="empty-state">
                <div className="icon">📝</div>
                <div className="text">
                  {activeEntry && !activeEntry.option ? '这个场次还没匹配玩家，去今日场次凑桌吧～' : '请选择左侧一个场次进行核对'}
                </div>
              </div>
            </div>
          ) : (() => {
            const { session, script, option } = activeEntry
            const s = sessions.find(x => x.id === session.id) ?? session
            const checked = s.confirmed ?? { scriptName: false, playerCount: false, price: false, startTime: false, carpoolSuccess: false }
            const allDone = allChecked(s)
            return (
              <>
                <div className="summary-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                        {script.name}
                        <span className={`session-type-badge type-${script.type}`} style={{ marginLeft: 10, fontSize: 12, padding: '3px 10px' }}>
                          {({ joy: '欢乐', mechanism: '机制', emotion: '情感', reasoning: '推理', terror: '恐怖' } as any)[script.type]}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                        {session.roomName} · DM {session.dmName} · 开场 {formatFullTime(session.startTime)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: allDone ? 'var(--success)' : 'var(--primary)' }}>
                        {Object.values(checked).filter(Boolean).length}/5
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                        {allDone ? '✅ 全部核对完成' : '核对进度'}
                      </div>
                    </div>
                  </div>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <div className="num">{option.totalCount}</div>
                      <div className="label">总人数</div>
                    </div>
                    <div className="summary-item">
                      <div className="num">{option.players.length}</div>
                      <div className="label">组数</div>
                    </div>
                    <div className="summary-item">
                      <div className="num">¥{script.price * option.totalCount}</div>
                      <div className="label">预计收入</div>
                    </div>
                    <div className="summary-item">
                      <div className="num">{script.durationHours}h</div>
                      <div className="label">预计时长</div>
                    </div>
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-title">
                    <span>✅ 口头确认清单（逐项向玩家确认后打勾）</span>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        const all = Object.values(checked).every(Boolean)
                        const nv = { scriptName: !all, playerCount: !all, price: !all, startTime: !all, carpoolSuccess: !all }
                        if (s.status === 'confirmed') {
                          updateSession(s.id, { confirmed: nv })
                        }
                      }}
                    >
                      {Object.values(checked).every(Boolean) ? '重置勾选' : '全部勾选'}
                    </button>
                  </div>

                  <div className="confirm-list">
                    {confirmItems.map(item => (
                      <div
                        key={item.key}
                        className={`confirm-item ${checked[item.key] ? 'checked' : ''}`}
                        onClick={() => toggleConfirm(s.id, item.key)}
                      >
                        <div className="confirm-check">
                          {checked[item.key] && <span>✓</span>}
                        </div>
                        <div className="confirm-text">
                          <div style={{ fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
                          <div>{item.renderValue({ session: s, script, option })}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="divider" />

                  <div className="panel-title" style={{ marginBottom: 10 }}>
                    <span>👥 玩家名单（{option.totalCount} 人）</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                    {option.players.map(p => (
                      <PlayerCard key={p.id} player={p} showActions={false} />
                    ))}
                  </div>

                  <div className="divider" />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {allDone ? '✅ 全部核对完毕，可以通知玩家了' : '请逐项核对完成后再通知落座'}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {allDone && (
                        <>
                          <button className="btn" onClick={generateSeatingSlip}>📋 生成入座单</button>
                          <button className="btn" onClick={generateDMChecklist}>📝 生成 DM 准备清单</button>
                        </>
                      )}
                      <button
                        className="btn"
                        disabled={s.status !== 'confirmed'}
                        onClick={() => {
                          if (confirm('确定标记为进行中吗？')) {
                            updateSession(s.id, { status: 'playing' })
                          }
                        }}
                      >
                        🎲 标记开本
                      </button>
                      <button
                        className="btn btn-primary btn-lg"
                        disabled={!allDone}
                        onClick={notifyAndSeat}
                      >
                        📣 通知玩家落座 / 复制群消息
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {generatedText && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setGeneratedText(null)}>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 520, width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>{generatedText.title}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(generatedText.content); alert('已复制到剪贴板') }}>📋 复制</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setGeneratedText(null)}>✕ 关闭</button>
              </div>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.8, color: 'var(--text)', background: 'var(--bg)', padding: 16, borderRadius: 8 }}>{generatedText.content}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
