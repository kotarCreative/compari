'use node'
import {
  deterministicRanking,
  normalizeRankingDto,
  rankingSystemInstruction,
} from '../domain/ranking'
import { generateOpenAIStructuredOutput } from './openai.ts'
import { isDemoMode } from './runtime.ts'
import type { RankingPort } from '../ports/ranking'

export function getRankingPort(): RankingPort {
  return {
    rank: async (input) => {
      if (isDemoMode())
        return deterministicRanking(input.candidates.map((x) => x.candidateId))
      const candidateIds = new Set(input.candidates.map((x) => x.candidateId))
      const schema = {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'rankings'],
        properties: {
          schemaVersion: { type: 'integer', enum: [1] },
          rankings: {
            type: 'array',
            maxItems: 5,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['candidateId', 'score', 'reason', 'caveats'],
              properties: {
                candidateId: { type: 'string' },
                score: { type: 'number', minimum: 0, maximum: 100 },
                reason: { type: 'string', maxLength: 500 },
                caveats: {
                  type: 'array',
                  maxItems: 4,
                  items: { type: 'string', maxLength: 240 },
                },
              },
            },
          },
        },
      }
      const parsed = await generateOpenAIStructuredOutput({
        operation: 'ranking',
        name: 'candidate_ranking',
        schema,
        system: rankingSystemInstruction,
        user: JSON.stringify(input).slice(0, 24_000),
      })
      const dto = normalizeRankingDto(parsed, candidateIds)
      if (!dto)
        throw new Error(
          'needs_user: OpenAI ranking returned unsafe candidate data',
        )
      return dto
    },
  }
}
