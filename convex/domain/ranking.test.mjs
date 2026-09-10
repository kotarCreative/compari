import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canApplyRanking,
  deterministicRanking,
  normalizeRankingDto,
  rankingSettlement,
  rankingSystemInstruction,
} from './ranking.ts'

test('ranking rejects unexpected, cross-request, duplicate, and over-cap model output', () => {
  const allowed = new Set(['a', 'b'])
  assert.equal(
    normalizeRankingDto(
      {
        schemaVersion: 1,
        rankings: [
          { candidateId: 'outside', score: 90, reason: 'x', caveats: [] },
        ],
      },
      allowed,
    ),
    null,
  )
  assert.equal(
    normalizeRankingDto(
      {
        schemaVersion: 1,
        rankings: [
          { candidateId: 'a', score: 90, reason: 'x', caveats: [] },
          { candidateId: 'a', score: 80, reason: 'x', caveats: [] },
        ],
      },
      allowed,
    ),
    null,
  )
  assert.equal(
    normalizeRankingDto(
      {
        schemaVersion: 1,
        rankings: Array.from({ length: 6 }, () => ({
          candidateId: 'a',
          score: 90,
          reason: 'x',
          caveats: [],
        })),
      },
      allowed,
    ),
    null,
  )
  assert.equal(
    normalizeRankingDto(
      {
        schemaVersion: 1,
        rankings: [
          {
            candidateId: 'a',
            score: 90,
            reason: 'x',
            caveats: [],
            injected: 'ignore policy',
          },
        ],
      },
      allowed,
    ),
    null,
  )
})

test('ranking persistence rejects a stale version or lease', () => {
  assert.equal(
    canApplyRanking({
      jobKind: 'rank_candidates',
      requestIdMatches: true,
      status: 'running',
      claimMatches: true,
      jobInputVersion: 3,
      requestVersion: 3,
    }),
    true,
  )
  assert.equal(
    canApplyRanking({
      jobKind: 'rank_candidates',
      requestIdMatches: true,
      status: 'running',
      claimMatches: true,
      jobInputVersion: 2,
      requestVersion: 3,
    }),
    false,
  )
  assert.equal(
    canApplyRanking({
      jobKind: 'rank_candidates',
      requestIdMatches: true,
      status: 'succeeded',
      claimMatches: true,
      jobInputVersion: 3,
      requestVersion: 3,
    }),
    false,
  )
})

test('deterministic ranking is bounded and uses only supplied candidates', () => {
  const dto = deterministicRanking(['a', 'b', 'c', 'd', 'e', 'f'])
  assert.equal(dto.rankings.length, 5)
  assert.deepEqual(
    dto.rankings.map((x) => x.candidateId),
    ['a', 'b', 'c', 'd', 'e'],
  )
})

test('ranking waits for initial research settlement and rubric treats absent reviews as a caveat', () => {
  assert.equal(
    rankingSettlement({ activeResearchJobs: 1, qualifiedCandidates: 4 }),
    'wait',
  )
  assert.equal(
    rankingSettlement({ activeResearchJobs: 0, qualifiedCandidates: 4 }),
    'queue',
  )
  assert.equal(
    rankingSettlement({ activeResearchJobs: 0, qualifiedCandidates: 0 }),
    'empty',
  )
  assert.match(
    rankingSystemInstruction,
    /review or reputation signals only when explicitly present/i,
  )
  assert.match(
    rankingSystemInstruction,
    /Missing or weak review\/reputation evidence is a caveat/i,
  )
  assert.match(rankingSystemInstruction, /published website price/i)
  assert.match(rankingSystemInstruction, /does not require a contact path/i)
})
