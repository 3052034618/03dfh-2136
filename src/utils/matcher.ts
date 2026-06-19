import { Player, Script, Session, MatchOption, MatchConflict, ConflictType } from '../types'

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

  const waitTime = Date.now() - Math.min(...players.map(p => p.arrivalTime))
  score += Math.floor(waitTime / 1000 / 60) * 0.3

  return score
}

export function generateMatchOptions(
  session: Session,
  script: Script,
  allPlayers: Player[]
): MatchOption[] {
  const options: MatchOption[] = []
  const seen = new Set<string>()

  const soloPlayers = allPlayers.filter(p => !p.groupId)
  const groups = allPlayers.filter(p => p.groupId)
  const uniqueGroups = Array.from(new Map(groups.map(g => [g.groupId!, g])).values())

  function tryBuild(candidates: Player[]): MatchOption | null {
    const total = sumCount(candidates)
    if (total < script.minPlayers || total > script.maxPlayers) return null
    const conflicts = detectConflicts(candidates, script, session)
    if (conflicts.some(c => c.severity === 'block' && c.type !== 'group_split')) return null
    const key = candidates.map(p => p.id).sort().join(',')
    if (seen.has(key)) return null
    seen.add(key)
    return {
      id: uid(),
      sessionId: session.id,
      players: candidates,
      totalCount: total,
      conflicts,
      score: computeScore(candidates, script, conflicts),
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

  for (const gs of groupSubsets) {
    const groupMembers: Player[] = []
    for (const g of gs) {
      groupMembers.push(...groups.filter(gr => gr.groupId === g.groupId))
    }
    const groupTotal = sumCount(groupMembers)
    if (groupTotal > script.maxPlayers) continue

    if (groupTotal >= script.minPlayers && groupTotal <= script.maxPlayers) {
      const opt = tryBuild(groupMembers)
      if (opt) options.push(opt)
    }

    const needMin = Math.max(0, script.minPlayers - groupTotal)
    const needMax = script.maxPlayers - groupTotal
    for (const ss of soloSubsets) {
      const soloTotal = sumCount(ss)
      if (soloTotal < needMin || soloTotal > needMax) continue
      if (hasConflictingGroup(groupMembers, ss)) continue
      const opt = tryBuild([...groupMembers, ...ss])
      if (opt) options.push(opt)
    }
  }

  for (const ss of soloSubsets) {
    const soloTotal = sumCount(ss)
    if (soloTotal < script.minPlayers || soloTotal > script.maxPlayers) continue
    const opt = tryBuild(ss)
    if (opt) options.push(opt)
  }

  const sorted = options
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(o => ({ ...o, id: uid() }))

  return sorted
}
