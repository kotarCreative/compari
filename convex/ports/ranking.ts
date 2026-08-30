import type { RankingDto } from '../domain/ranking'

export type RankingCandidate = {
  candidateId: string
  name: string
  retainedEvidence: Array<{ label: string; excerpt: string; sourceType: string; observedAt: number; confidence: number }>
  safePublicContactPaths: Array<string>
}
export interface RankingPort {
  rank: (input: { prompt: string; requestRequirements: Array<{ key: string; value: string }>; candidates: Array<RankingCandidate> }) => Promise<RankingDto>
}
