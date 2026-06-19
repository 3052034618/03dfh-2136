import { Player, Script, Session, MatchOption, MatchConflict, ConflictType, PLAYER_SOURCE_LABELS } from '../types'

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function sumCount(players: Player[]) {
  return players.reduce((s, p) => s + p.count, 0)
}

function hasConflictingGroup(playersA: Player[], playersB: Player[]) {
  const groups = new Set(playersA.filter(p => p.groupId).map(p => p.groupId))
  return playersB.some(p => p.groupId && groups.has(p.groupId))
}

function buildReasons(players: Player[], script: Script, conflicts: MatchConflict[]): string[] {
  const reasons: string[] = []
  const total = sumCount(players)

  if (total === script.bestPlayers) {
    reasons.push(`达到最佳人数 ${script.bestPlayers} 人`)
  } else if (total === script.minPlayers) {
    reasons.push(`刚好达到最低人数 ${script.minPlayers} 人`)
  }

  const avgWait = players.reduce((s, p) => s + (Date.now() - p.arrivalTime), 0) / players.length / 60000
  if (avgWait > 20) {
    const longest = players.reduce((a, b) => a.arrivalTime < b.arrivalTime ? a : b)
    reasons.push(`${longest.name} 等候已超 ${Math.round((Date.now() - longest.arrivalTime) / 60000)} 分钟`)
  }

  const onSiteCount = players.filter(p => p.status === 'waiting' || p.status === 'notified').length
  if (onSiteCount === players.length) {
    reasons.push('所有玩家均在现场')
  }

  const walkins = players.filter(p => p.source === 'walkin')
  const resLate = players.filter(p => p.source === 'reservation_late')
  if (walkins.length > 0) reasons.push(`${walkins.length} 组散客直接到店`)
  if (resLate.length > 0) reasons.push(`${resLate.length} 组预约迟到，优先安排`)

  if (script.type === 'joy') {
    const noisy = players.filter(p => p.tags.includes('noisy')).length
    if (noisy > 0) reasons.push(`${noisy} 组爱吵闹玩家适合欢乐本`)
  }
  if (script.type === 'mechanism') {
    const mech = players.filter(p => p.tags.includes('mechanism_expert')).length
    if (mech > 0) reasons.push(`${mech} 组机制老手适合机制本`)
  }

  const groups = players.filter(p => p.groupId)
  if (groups.length > 0) {
    const uniqueGroups = new Set(groups.map(p => p.groupId)).size
    reasons.push(`${uniqueGroups} 个团体整体安排不拆开`)
  }

  const newbies = players.filter(p => p.proficiency === 'newbie')
  const helpers = players.filter(p => p.tags.includes('newbie_friendly'))
  if (newbies.length > 0 && helpers.length > 0) {
    reasons.push(`${helpers.length} 组新手友好玩家可带 ${newbies.length} 组新手`)
  }

  return reasons
}

function detectConflicts(
  players: Player[],
  script: Script,
  session: Session
): MatchConflict[] {
  const conflicts: MatchConflict[] = []
  const total = sumCount(players)

  if (total > script.maxPlayers) {
    conflicts.push({
      type: 'over_max',
      severity: 'block',
      message: `人数 ${total} 超过剧本上限 ${script.maxPlayers}`,
    })
  }

  if (total < script.minPlayers) {
    conflicts.push({
      type: 'over_max',
      severity: 'block',
      message: `人数 ${total} 不足剧本最低 ${script.minPlayers}`,
    })
  }

  const groupMap = new Map<string, Player[]>()
  for (const p of players) {
    if (p.groupId) {
      if (!groupMap.has(p.groupId)) groupMap.set(p.groupId, [])
      groupMap.get(p.groupId)!.push(p)
    }
  }
  for (const [gid, members] of groupMap) {
    const totalInGroup = sumCount(members)
    const anyMind = members.some(m => m.mindAcquaintance)
    if (anyMind && totalInGroup !== members[0].count) {
      conflicts.push({
        type: 'group_split',
        severity: 'block',
        message: `团队「${members[0].groupName ?? gid}」要求熟人不拆，但被分开`,
        involvedPlayerIds: members.map(m => m.id),
      })
    }
  }

  if (script.crossGender === 'forbidden' && players.some(p => !p.canCrossGender)) {
    const affected = players.filter(p => !p.canCrossGender)
    conflicts.push({
      type: 'cross_gender_needed',
      severity: 'warn',
      message: `剧本禁止反串，但有 ${affected.length} 名玩家无法接受反串，需注意性别分配`,
      involvedPlayerIds: affected.map(p => p.id),
    })
  } else if (script.crossGender === 'avoid' && players.some(p => !p.canCrossGender)) {
    const affected = players.filter(p => !p.canCrossGender)
    if (affected.length > Math.ceil(total / 2)) {
      conflicts.push({
        type: 'cross_gender_needed',
        severity: 'warn',
        message: `剧本尽量不反串，但有 ${affected.length} 人不接受反串，可能需要协调`,
        involvedPlayerIds: affected.map(p => p.id),
      })
    }
  }

  const mindPlayers = players.filter(p => p.mindAcquaintance && !p.groupId)
  if (mindPlayers.length >= 2) {
    conflicts.push({
      type: 'acquaintance_mind',
      severity: 'warn',
      message: `${mindPlayers.length} 名单身玩家介意和陌生人同车，建议提前说明`,
      involvedPlayerIds: mindPlayers.map(p => p.id),
    })
  }

  const minAvailable = Math.min(...players.map(p => p.availableHours))
  if (minAvailable < script.durationHours) {
    const shortPlayers = players.filter(p => p.availableHours < script.durationHours)
    conflicts.push({
      type: 'duration_short',
      severity: 'warn',
      message: `剧本预计 ${script.durationHours}h，但有 ${shortPlayers.length} 人可玩时长不足`,
      involvedPlayerIds: shortPlayers.map(p => p.id),
    })
  }

  const newbies = players.filter(p => p.proficiency === 'newbie')
  const experts = players.filter(p => p.proficiency === 'expert')
  if (script.difficulty >= 4 && newbies.length > 0) {
    conflicts.push({
      type: 'proficiency_mismatch',
      severity: 'warn',
      message: `本难度 ${script.difficulty}/5，含 ${newbies.length} 名新手，请DM注意扶车`,
      involvedPlayerIds: newbies.map(p => p.id),
    })
  }
  if (script.difficulty <= 2 && experts.length > 0 && total <= script.minPlayers + 1) {
    conflicts.push({
      type: 'proficiency_mismatch',
      severity: 'warn',
      message: `本难度较低（${script.difficulty}/5），含 ${experts.length} 名老玩家，可能觉得太简单`,
      involvedPlayerIds: experts.map(p => p.id),
    })
  }

  return conflicts
}

function computeScore(players: Player[], script: Script, conflicts: MatchConflict[]): number {
  let score = 0
  const total = sumCount(players)
  if (total === script.bestPlayers) score += 100
  else if (total === script.minPlayers) score += 60
  else if (total === script.maxPlayers) score += 70
  else if (total > script.bestPlayers) score += 50 - (total - script.bestPlayers) * 5
  else score += 50 - (script.bestPlayers - total) * 10

  const allNoisy = players.some(p => p.tags.includes('noisy'))
  if (script.type === 'joy' && allNoisy) score += 20

  const experts = players.filter(p => p.tags.includes('mechanism_expert')).length
  if (script.type === 'mechanism' && experts > 0) score += 15 * Math.min(experts, 3)

  const newbies = players.filter(p => p.proficiency === 'newbie').length
  const helpers = players.filter(p => p.tags.includes('newbie_friendly')).length
  if (newbies > 0 && helpers > 0) score += 10

  score -= conflicts.filter(c => c.severity === 'block').length * 1000
  score -= conflicts.filter(c => c.severity === 'warn').length * 8

  const now = Date.now()
  const avgWaitMin = players.reduce((s, p) => s + (now - p.arrivalTime), 0) / players.length / 60000
  score += avgWaitMin * 0.8

  const onSiteCount = players.filter(p => p.status === 'waiting' || p.status === 'notified').length
  score += onSiteCount * 5

  const resLate = players.filter(p => p.source === 'reservation_late').length
  score += resLate * 8

  return score
}

export function generateMatchOptions(
  session: Session,
  script: Script,
  allPlayers: Player[],
  lockedPlayerIds: string[] = []
): MatchOption[] {
  const activePlayers = allPlayers.filter(p => p.status !== 'abandoned')
  const options: MatchOption[] = []
  const seen = new Set<string>()

  const lockedIds = new Set(lockedPlayerIds)
  let lockedPlayers = activePlayers.filter(p => lockedIds.has(p.id))
  if (session.bookedPlayers?.length) {
    const existingLockedIds = new Set(lockedPlayers.map(p => p.id))
    for (const bp of session.bookedPlayers) {
      if (lockedIds.has(bp.id) && !existingLockedIds.has(bp.id) && bp.status !== 'abandoned') {
        lockedPlayers.push(bp)
      }
    }
  }
  const availableCandidates = activePlayers.filter(p => !lockedIds.has(p.id))

  const lockedCount = sumCount(lockedPlayers)
  if (lockedCount > script.maxPlayers) {
    return []
  }

  const soloPlayers = availableCandidates.filter(p => !p.groupId)
  const groups = availableCandidates.filter(p => p.groupId)
  const uniqueGroups = Array.from(new Map(groups.map(g => [g.groupId!, g])).values())

  function tryBuild(candidates: Player[]): MatchOption | null {
    const total = sumCount(candidates)
    if (total < script.minPlayers || total > script.maxPlayers) return null
    const conflicts = detectConflicts(candidates, script, session)
    if (conflicts.some(c => c.severity === 'block' && c.type !== 'group_split')) return null
    const key = candidates.map(p => p.id).sort().join(',')
    if (seen.has(key)) return null
    seen.add(key)
    const computedConflicts = conflicts
    const computedScore = computeScore(candidates, script, conflicts)
    const computedReasons = buildReasons(candidates, script, conflicts)
    return {
      id: uid(),
      sessionId: session.id,
      players: candidates,
      lockedPlayerIds: [...lockedPlayerIds],
      totalCount: total,
      conflicts: computedConflicts,
      score: computedScore,
      reasons: computedReasons,
    }
  }

  function pickSubsets<T>(arr: T[], maxK: number): T[][] {
    const res: T[][] = [[]]
    for (let k = 1; k <= Math.min(maxK, arr.length); k++) {
      const indices: number[] = Array.from({ length: k }, (_, i) => i)
      while (indices[0] <= arr.length - k) {
        res.push(indices.map(i => arr[i]))
        let i = k - 1
        for (; i >= 0 && indices[i] === arr.length - k + i; i--);
        if (i < 0) break
        indices[i]++
        for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1
      }
    }
    return res
  }

  const groupSubsets = pickSubsets(uniqueGroups, 4)
  const soloSubsets = pickSubsets(soloPlayers, Math.min(8, soloPlayers.length))

  if (lockedPlayers.length > 0) {
    const opt = tryBuild([...lockedPlayers])
    if (opt) options.push(opt)
  }

  for (const gs of groupSubsets) {
    const groupMembers: Player[] = []
    for (const g of gs) {
      groupMembers.push(...groups.filter(gr => gr.groupId === g.groupId))
    }
    const groupTotal = sumCount(groupMembers)
    if (lockedCount + groupTotal > script.maxPlayers) continue

    if (lockedCount + groupTotal >= script.minPlayers && lockedCount + groupTotal <= script.maxPlayers) {
      const opt = tryBuild([...lockedPlayers, ...groupMembers])
      if (opt) options.push(opt)
    }

    const needMin = Math.max(0, script.minPlayers - lockedCount - groupTotal)
    const needMax = script.maxPlayers - lockedCount - groupTotal
    for (const ss of soloSubsets) {
      const soloTotal = sumCount(ss)
      if (soloTotal < needMin || soloTotal > needMax) continue
      if (hasConflictingGroup(groupMembers, ss)) continue
      const opt = tryBuild([...lockedPlayers, ...groupMembers, ...ss])
      if (opt) options.push(opt)
    }
  }

  if (lockedPlayers.length === 0) {
    for (const ss of soloSubsets) {
      const soloTotal = sumCount(ss)
      if (soloTotal < script.minPlayers || soloTotal > script.maxPlayers) continue
      const opt = tryBuild(ss)
      if (opt) options.push(opt)
    }
  } else {
    const needMin = Math.max(0, script.minPlayers - lockedCount)
    const needMax = script.maxPlayers - lockedCount
    for (const ss of soloSubsets) {
      const soloTotal = sumCount(ss)
      if (soloTotal < needMin || soloTotal > needMax) continue
      const opt = tryBuild([...lockedPlayers, ...ss])
      if (opt) options.push(opt)
    }
  }

  const sorted = options
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(o => ({ ...o, id: uid() }))

  return sorted
}
