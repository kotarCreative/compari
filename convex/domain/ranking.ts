export type RankingItem = { candidateId: string; score: number; reason: string; caveats: Array<string> }
export type RankingDto = { schemaVersion: 1; rankings: Array<RankingItem> }

export const rankingSystemInstruction = `Rank only the supplied candidates. Use only retained request requirements and retained public website evidence. Weigh request fit; evidence of relevant offerings or capabilities; review or reputation signals only when explicitly present in retained evidence; evidence quality and freshness; explicit caveats; and safe public contactability. Missing or weak review/reputation evidence is a caveat, never a rating. Never invent facts, reviews, prices, availability, certifications, or contact paths. A score is only a relative shortlist ordering, not a quality grade. Return JSON only.`

export function rankingSettlement(input: { activeResearchJobs: number; qualifiedCandidates: number }): 'wait' | 'queue' | 'empty' {
  if (input.activeResearchJobs > 0) return 'wait'
  return input.qualifiedCandidates > 0 ? 'queue' : 'empty'
}

export function normalizeRankingDto(value: unknown, allowedIds: ReadonlySet<string>): RankingDto | null {
  if (!value || typeof value !== 'object') return null
  const root = value as Record<string, unknown>
  if (Object.keys(root).some(key => key !== 'schemaVersion' && key !== 'rankings')) return null
  if (root.schemaVersion !== 1 || !Array.isArray(root.rankings)) return null
  const seen = new Set<string>()
  const rankings: Array<RankingItem> = []
  for (const row of root.rankings) {
    if (!row || typeof row !== 'object') return null
    const item = row as Record<string, unknown>
    if (Object.keys(item).some(key => !['candidateId', 'score', 'reason', 'caveats'].includes(key))) return null
    if (typeof item.candidateId !== 'string' || !allowedIds.has(item.candidateId) || seen.has(item.candidateId) ||
      typeof item.score !== 'number' || !Number.isFinite(item.score) || item.score < 0 || item.score > 100 ||
      typeof item.reason !== 'string' || !Array.isArray(item.caveats)) return null
    const caveats = item.caveats.filter((x): x is string => typeof x === 'string').slice(0, 4).map(x => x.slice(0, 240))
    if (caveats.length !== item.caveats.length || !item.reason.trim()) return null
    seen.add(item.candidateId)
    rankings.push({ candidateId: item.candidateId, score: item.score, reason: item.reason.slice(0, 500), caveats })
  }
  if (rankings.length > 5) return null
  return { schemaVersion: 1, rankings: rankings.sort((a, b) => b.score - a.score) }
}

/** A model result may be persisted only by the exact, current job lease. */
export function canApplyRanking(input: { jobKind: string; requestIdMatches: boolean; status: string; claimMatches: boolean; jobInputVersion?: number; requestVersion: number }): boolean {
  return input.jobKind === 'rank_candidates' && input.requestIdMatches && input.status === 'running' && input.claimMatches && input.jobInputVersion === input.requestVersion
}

export function deterministicRanking(candidateIds: Array<string>): RankingDto {
  return { schemaVersion: 1, rankings: candidateIds.slice(0, 5).map((candidateId, index) => ({
    candidateId, score: 90 - index * 5,
    reason: 'Demo ranking uses retained website evidence and an available public contact path.',
    caveats: ['Demo fixture: confirm current pricing and availability with the provider.'],
  })) }
}
