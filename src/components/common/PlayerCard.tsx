import { Player, PLAYER_TAG_LABELS, PLAYER_TAG_COLORS, Proficiency, PlayerTag, PLAYER_SOURCE_LABELS, PLAYER_STATUS_LABELS, PLAYER_STATUS_COLORS, PlayerStatus } from '../../types'

const PROF_LABELS: Record<Proficiency, string> = {
  newbie: '新手',
  familiar: '熟悉',
  expert: '老手',
}

export function formatWaitTime(ts: number): { text: string; long: boolean } {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return { text: '刚到', long: false }
  if (mins < 60) return { text: `${mins}分钟前`, long: mins >= 30 }
  const hrs = Math.floor(mins / 60)
  return { text: `${hrs}小时${mins % 60}分前`, long: true }
}

export function ProfBadge({ level }: { level: Proficiency }) {
  return <span className={`prof-badge prof-${level}`}>{PROF_LABELS[level]}</span>
}

export function TagChip({ tag, onClick, selected }: { tag: keyof typeof PLAYER_TAG_LABELS; onClick?: () => void; selected?: boolean }) {
  const style = selected ? { background: PLAYER_TAG_COLORS[tag] } : undefined
  return (
    <span
      className={`tag-mini ${selected ? 'tag-chip selected' : ''}`}
      style={style}
      onClick={onClick}
    >
      {PLAYER_TAG_LABELS[tag]}
    </span>
  )
}

export function PlayerCard({
  player, selected, onSelect, onEdit, onRemove, onUpdateStatus, showActions = true,
}: {
  player: Player
  selected?: boolean
  onSelect?: () => void
  onEdit?: () => void
  onRemove?: () => void
  onUpdateStatus?: (id: string, status: PlayerStatus) => void
  showActions?: boolean
}) {
  const wait = formatWaitTime(player.arrivalTime)
  return (
    <div className={`player-card ${selected ? 'selected' : ''}`} onClick={onSelect} style={onSelect ? { cursor: 'pointer' } : undefined}>
      <div className="player-card-header">
        <div>
          <span className="player-name">{player.name}</span>
          {player.groupName && <span className="player-group-indicator">{player.groupName}</span>}
        </div>
        <span className="player-count">{player.count}人</span>
      </div>
      <div className="player-info-grid">
        <span className="key">熟练度</span>
        <span><ProfBadge level={player.proficiency} /></span>
        <span className="key">可玩时长</span>
        <span>{player.availableHours}小时</span>
        <span className="key">反串</span>
        <span>{player.canCrossGender ? '接受' : '不接受'}</span>
        <span className="key">介意熟人</span>
        <span>{player.mindAcquaintance ? '介意陌生人' : '都可以'}</span>
        <span className="key">来源</span>
        <span>{PLAYER_SOURCE_LABELS[player.source]}</span>
        <span className="key">到店时间</span>
        <span className={`wait-time ${wait.long ? 'long' : ''}`}>{wait.text}</span>
        <span className="key">状态</span>
        <span style={{ color: PLAYER_STATUS_COLORS[player.status], fontWeight: 600 }}>{PLAYER_STATUS_LABELS[player.status]}</span>
      </div>
      {player.tags.length > 0 && (
        <div className="player-tags">
          {player.tags.map(t => (
            <TagChip key={t} tag={t} />
          ))}
        </div>
      )}
      {player.note && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--warning)' }}>
          📝 {player.note}
        </div>
      )}
      {showActions && (
        <div className="player-actions">
          {onEdit && <button className="btn btn-sm" onClick={e => { e.stopPropagation(); onEdit() }}>编辑</button>}
          {player.status === 'waiting' && onUpdateStatus && (
            <button className="btn btn-sm" style={{ background: 'var(--info)', color: 'white' }} onClick={e => { e.stopPropagation(); onUpdateStatus(player.id, 'notified') }}>已通知</button>
          )}
          {player.status !== 'abandoned' && onUpdateStatus && (
            <button className="btn btn-sm" style={{ background: 'var(--text-muted)', color: 'white' }} onClick={e => { e.stopPropagation(); onUpdateStatus(player.id, 'abandoned') }}>已放弃</button>
          )}
          {onRemove && <button className="btn btn-sm btn-danger" onClick={e => { e.stopPropagation(); onRemove() }}>移出</button>}
        </div>
      )}
    </div>
  )
}
