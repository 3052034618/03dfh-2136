import { useState } from 'react'
import { useApp } from '../store/AppContext'
import { PlayerTag, PLAYER_TAG_LABELS, PLAYER_TAG_COLORS, Proficiency, Player, PlayerSource, PlayerStatus, PLAYER_SOURCE_LABELS, PLAYER_STATUS_LABELS, PLAYER_STATUS_COLORS } from '../types'
import { PlayerCard } from './common/PlayerCard'

const TAG_LIST: PlayerTag[] = ['noisy', 'newbie_friendly', 'mechanism_expert', 'emotional', 'reasoning', 'social_bull', 'first_time', 'vip']
const SOURCE_LIST: PlayerSource[] = ['walkin', 'reservation_late', 'friend_brought', 'online']
const STATUS_LIST: PlayerStatus[] = ['waiting', 'notified', 'abandoned']

function emptyForm(): Omit<Player, 'id' | 'arrivalTime'> {
  return {
    name: '',
    phone: '',
    groupId: undefined,
    groupName: undefined,
    count: 1,
    proficiency: 'familiar',
    availableHours: 4,
    canCrossGender: true,
    mindAcquaintance: false,
    tags: [],
    note: '',
    source: 'walkin',
    status: 'waiting',
  }
}

export default function PlayerPool() {
  const { players, addPlayer, removePlayer, updatePlayer } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [groupEnabled, setGroupEnabled] = useState(false)
  const [filterProf, setFilterProf] = useState<Proficiency | 'all'>('all')
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<PlayerTag | 'all'>('all')
  const [filterSource, setFilterSource] = useState<PlayerSource | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<PlayerStatus | 'all'>('all')

  const startEdit = (p: Player) => {
    setForm({
      name: p.name,
      phone: p.phone,
      groupId: p.groupId,
      groupName: p.groupName,
      count: p.count,
      proficiency: p.proficiency,
      availableHours: p.availableHours,
      canCrossGender: p.canCrossGender,
      mindAcquaintance: p.mindAcquaintance,
      tags: [...p.tags],
      note: p.note ?? '',
      source: p.source,
      status: p.status,
    })
    setGroupEnabled(!!p.groupId)
    setEditingId(p.id)
    setShowForm(true)
  }

  const submitForm = () => {
    if (!form.name.trim()) return
    const payload = {
      ...form,
      name: form.name.trim(),
      groupId: groupEnabled ? (form.groupId ?? `g_${Date.now()}`) : undefined,
      groupName: groupEnabled ? form.groupName?.trim() || undefined : undefined,
      tags: [...form.tags],
      note: form.note?.trim() || undefined,
    }
    if (editingId) {
      updatePlayer(editingId, payload)
    } else {
      addPlayer(payload)
    }
    resetForm()
  }

  const resetForm = () => {
    setForm(emptyForm())
    setEditingId(null)
    setShowForm(false)
    setGroupEnabled(false)
  }

  const toggleTag = (t: PlayerTag) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t],
    }))
  }

  const handleUpdateStatus = (id: string, status: PlayerStatus) => {
    updatePlayer(id, { status })
  }

  const totalWaiting = players.reduce((s, p) => s + p.count, 0)
  const groupCount = new Set(players.filter(p => p.groupId).map(p => p.groupId)).size
  const notifiedCount = players.filter(p => p.status === 'notified').length
  const abandonedCount = players.filter(p => p.status === 'abandoned').length
  const longWaitCount = players.filter(p => Date.now() - p.arrivalTime > 30 * 60000).length

  const filtered = players.filter(p => {
    if (filterProf !== 'all' && p.proficiency !== filterProf) return false
    if (tagFilter !== 'all' && !p.tags.includes(tagFilter)) return false
    if (search && !p.name.includes(search)) return false
    if (filterSource !== 'all' && p.source !== filterSource) return false
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => a.arrivalTime - b.arrivalTime)

  return (
    <div>
      <div className="stats-bar">
        <div className="stat-card warning">
          <div className="stat-num">{players.length}</div>
          <div className="stat-label">候补组数</div>
        </div>
        <div className="stat-card primary">
          <div className="stat-num">{totalWaiting}</div>
          <div className="stat-label">等候总人数</div>
        </div>
        <div className="stat-card info">
          <div className="stat-num">{notifiedCount}</div>
          <div className="stat-label">已通知</div>
        </div>
        <div className="stat-card" style={{ opacity: abandonedCount > 0 ? 1 : 0.5 }}>
          <div className="stat-num">{abandonedCount}</div>
          <div className="stat-label">已放弃</div>
        </div>
        <div className={`stat-card ${longWaitCount > 0 ? 'danger' : ''}`}>
          <div className="stat-num">{longWaitCount}</div>
          <div className="stat-label">等候超30分钟</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <span>候补玩家录入</span>
          {!showForm && (
            <div className="actions">
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                ➕ 录入玩家
              </button>
            </div>
          )}
        </div>

        {showForm && (
          <div>
            <div className="form-row">
              <div className="form-group">
                <label>姓名 / 称谓 *</label>
                <input
                  className="form-control"
                  placeholder="例：小明、小团体A"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>联系电话（选填）</label>
                <input
                  className="form-control"
                  placeholder="方便通知时用"
                  value={form.phone ?? ''}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row-3">
              <div className="form-group">
                <label>本次到店人数</label>
                <select
                  className="form-control"
                  value={form.count}
                  onChange={e => setForm({ ...form, count: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <option key={n} value={n}>{n} 人</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>熟练度</label>
                <select
                  className="form-control"
                  value={form.proficiency}
                  onChange={e => setForm({ ...form, proficiency: e.target.value as Proficiency })}
                >
                  <option value="newbie">新手（0-5本）</option>
                  <option value="familiar">熟悉（5-20本）</option>
                  <option value="expert">老手（20+本）</option>
                </select>
              </div>
              <div className="form-group">
                <label>可玩时长</label>
                <select
                  className="form-control"
                  value={form.availableHours}
                  onChange={e => setForm({ ...form, availableHours: Number(e.target.value) })}
                >
                  <option value={3}>3 小时（短本）</option>
                  <option value={4}>4 小时（标准）</option>
                  <option value={5}>5 小时（中等）</option>
                  <option value={6}>6 小时（长本）</option>
                  <option value={8}>8+ 小时（全天）</option>
                </select>
              </div>
              <div className="form-group">
                <label>玩家来源</label>
                <select className="form-control" value={form.source} onChange={e => setForm({ ...form, source: e.target.value as PlayerSource })}>
                  {SOURCE_LIST.map(s => <option key={s} value={s}>{PLAYER_SOURCE_LABELS[s]}</option>)}
                </select>
              </div>
            </div>

            <div className="checkbox-group" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginBottom: 12 }}>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.canCrossGender}
                  onChange={e => setForm({ ...form, canCrossGender: e.target.checked })}
                />
                <span>接受反串</span>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.mindAcquaintance}
                  onChange={e => setForm({ ...form, mindAcquaintance: e.target.checked })}
                />
                <span>介意陌生人拼车（只跟熟人）</span>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={groupEnabled}
                  onChange={e => {
                    setGroupEnabled(e.target.checked)
                    if (!e.target.checked) setForm(f => ({ ...f, groupId: undefined, groupName: undefined }))
                  }}
                />
                <span>属于某团队（需整体安排）</span>
              </label>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>当前状态</label>
              <div className="tags-selector">
                {STATUS_LIST.map(s => (
                  <span
                    key={s}
                    className={`tag-chip ${form.status === s ? 'selected' : ''}`}
                    style={form.status === s ? { background: PLAYER_STATUS_COLORS[s], borderColor: 'transparent', color: 'white' } : undefined}
                    onClick={() => setForm({ ...form, status: s })}
                  >
                    {PLAYER_STATUS_LABELS[s]}
                  </span>
                ))}
              </div>
            </div>

            {groupEnabled && (
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="form-group">
                  <label>团队名称（方便识别）</label>
                  <input
                    className="form-control"
                    placeholder="例：公司团建、生日局"
                    value={form.groupName ?? ''}
                    onChange={e => setForm({ ...form, groupName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>团队 ID（同组人填同一个即可）</label>
                  <input
                    className="form-control"
                    placeholder="可留空自动生成"
                    value={form.groupId ?? ''}
                    onChange={e => setForm({ ...form, groupId: e.target.value || undefined })}
                  />
                </div>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>贴标签（快速识别）</label>
              <div className="tags-selector">
                {TAG_LIST.map(t => (
                  <span
                    key={t}
                    className={`tag-chip ${form.tags.includes(t) ? 'selected' : ''}`}
                    style={form.tags.includes(t) ? { background: PLAYER_TAG_COLORS[t], borderColor: 'transparent', color: 'white' } : undefined}
                    onClick={() => toggleTag(t)}
                  >
                    {PLAYER_TAG_LABELS[t]}
                  </span>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>备注（DM特别注意）</label>
              <textarea
                className="form-control"
                placeholder="例：19点必须走、对花生过敏、需要静音..."
                value={form.note ?? ''}
                onChange={e => setForm({ ...form, note: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={submitForm}>
                {editingId ? '✓ 保存修改' : '✓ 加入候补池'}
              </button>
              <button className="btn" onClick={resetForm}>取消</button>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-title">
          <span>候补池（共 {sorted.length} 组 / {sorted.reduce((s, p) => s + p.count, 0)} 人）</span>
          <div className="actions">
            <input
              className="form-control"
              style={{ width: 160 }}
              placeholder="搜索姓名..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              className="form-control"
              style={{ width: 120 }}
              value={filterProf}
              onChange={e => setFilterProf(e.target.value as any)}
            >
              <option value="all">全部熟练度</option>
              <option value="newbie">新手</option>
              <option value="familiar">熟悉</option>
              <option value="expert">老手</option>
            </select>
            <select
              className="form-control"
              style={{ width: 130 }}
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value as any)}
            >
              <option value="all">全部标签</option>
              {TAG_LIST.map(t => (
                <option key={t} value={t}>{PLAYER_TAG_LABELS[t]}</option>
              ))}
            </select>
            <select className="form-control" style={{ width: 130 }} value={filterSource} onChange={e => setFilterSource(e.target.value as PlayerSource | 'all')}>
              <option value="all">全部来源</option>
              {SOURCE_LIST.map(s => <option key={s} value={s}>{PLAYER_SOURCE_LABELS[s]}</option>)}
            </select>
            <select className="form-control" style={{ width: 130 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value as PlayerStatus | 'all')}>
              <option value="all">全部状态</option>
              {STATUS_LIST.map(s => <option key={s} value={s}>{PLAYER_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🎭</div>
            <div className="text">候补池是空的，等玩家来吧～</div>
          </div>
        ) : (
          <div className="grid-list">
            {sorted.map(p => (
              <PlayerCard
                key={p.id}
                player={p}
                onEdit={() => startEdit(p)}
                onRemove={() => {
                  if (confirm(`确定把「${p.name}」移出候补池吗？`)) removePlayer(p.id)
                }}
                onUpdateStatus={handleUpdateStatus}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
