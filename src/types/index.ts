export type Proficiency = 'newbie' | 'familiar' | 'expert'

export type PlayerSource = 'walkin' | 'reservation_late' | 'friend_brought' | 'online'

export type PlayerStatus = 'waiting' | 'notified' | 'abandoned'

export const PLAYER_SOURCE_LABELS: Record<PlayerSource, string> = {
  walkin: '散客到店',
  reservation_late: '预约迟到',
  friend_brought: '朋友带来',
  online: '线上预约',
}

export const PLAYER_STATUS_LABELS: Record<PlayerStatus, string> = {
  waiting: '等候中',
  notified: '已通知',
  abandoned: '已放弃',
}

export const PLAYER_STATUS_COLORS: Record<PlayerStatus, string> = {
  waiting: '#f59e0b',
  notified: '#3b82f6',
  abandoned: '#6b7280',
}

export type PlayerTag =
  | 'noisy'
  | 'newbie_friendly'
  | 'mechanism_expert'
  | 'emotional'
  | 'reasoning'
  | 'social_bull'
  | 'first_time'
  | 'vip'

export const PLAYER_TAG_LABELS: Record<PlayerTag, string> = {
  noisy: '爱吵闹',
  newbie_friendly: '新手友好',
  mechanism_expert: '机制老手',
  emotional: '情感玩家',
  reasoning: '推理狂魔',
  social_bull: '社牛',
  first_time: '首次到店',
  vip: 'VIP',
}

export const PLAYER_TAG_COLORS: Record<PlayerTag, string> = {
  noisy: '#f59e0b',
  newbie_friendly: '#10b981',
  mechanism_expert: '#6366f1',
  emotional: '#ec4899',
  reasoning: '#8b5cf6',
  social_bull: '#f97316',
  first_time: '#14b8a6',
  vip: '#ef4444',
}

export interface Player {
  id: string
  name: string
  phone?: string
  groupId?: string
  groupName?: string
  count: number
  proficiency: Proficiency
  availableHours: number
  canCrossGender: boolean
  mindAcquaintance: boolean
  tags: PlayerTag[]
  note?: string
  source: PlayerSource
  status: PlayerStatus
  arrivalTime: number
}

export type ScriptType = 'joy' | 'mechanism' | 'emotion' | 'reasoning' | 'terror'

export const SCRIPT_TYPE_LABELS: Record<ScriptType, string> = {
  joy: '欢乐',
  mechanism: '机制',
  emotion: '情感',
  reasoning: '推理',
  terror: '恐怖',
}

export interface Script {
  id: string
  name: string
  type: ScriptType
  minPlayers: number
  bestPlayers: number
  maxPlayers: number
  durationHours: number
  difficulty: 1 | 2 | 3 | 4 | 5
  price: number
  crossGender: 'ok' | 'avoid' | 'forbidden'
}

export interface SessionHandover {
  confirmedAt?: number
  handlerName?: string
  playersNotified: boolean
  gameStarted: boolean
  gameStartedAt?: number
  lastViewedAt?: number
}

export interface Session {
  id: string
  scriptId: string
  startTime: number
  roomName: string
  dmName: string
  status: 'pending' | 'matched' | 'confirmed' | 'playing' | 'ended'
  bookedPlayers: Player[]
  confirmed?: {
    scriptName: boolean
    playerCount: boolean
    price: boolean
    startTime: boolean
    carpoolSuccess: boolean
  }
  handover?: SessionHandover
}

export interface MatchOption {
  id: string
  sessionId: string
  players: Player[]
  totalCount: number
  conflicts: MatchConflict[]
  score: number
  reasons: string[]
}

export type ConflictType =
  | 'group_split'
  | 'cross_gender_needed'
  | 'acquaintance_mind'
  | 'duration_short'
  | 'over_max'
  | 'proficiency_mismatch'

export interface MatchConflict {
  type: ConflictType
  message: string
  severity: 'warn' | 'block'
  involvedPlayerIds?: string[]
}
