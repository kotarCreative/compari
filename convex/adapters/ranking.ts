'use node'
import {
  deterministicRanking,
  normalizeRankingDto,
  rankingSystemInstruction,
} from '../domain/ranking'
import { openAIOutputText } from './reasoning'
import {
  deploymentEnv,
  isDemoMode,
  isRetryableHttpStatus,
  requireDeploymentEnv,
} from './runtime.ts'
import type { RankingPort } from '../ports/ranking'

export function getRankingPort(): RankingPort {
  return {
    rank: async (input) => {
      if (isDemoMode())
        return deterministicRanking(input.candidates.map((x) => x.candidateId))
      const key = requireDeploymentEnv(
        'OPENAI_API_KEY',
        'needs_user: OpenAI ranking is not configured',
      )
      const candidateIds = new Set(input.candidates.map((x) => x.candidateId))
      const schema = {
        type: 'object',
        additionalProperties: false,
        required: ['schemaVersion', 'rankings'],
        properties: {
          schemaVersion: { const: 1 },
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
      let response: Response
      try {
        response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: deploymentEnv('OPENAI_REASONING_MODEL') ?? 'gpt-4.1-mini',
            store: false,
            input: [
              { role: 'system', content: rankingSystemInstruction },
              { role: 'user', content: JSON.stringify(input).slice(0, 24_000) },
            ],
            text: {
              format: {
                type: 'json_schema',
                name: 'candidate_ranking',
                strict: true,
                schema,
              },
            },
          }),
        })
      } catch {
        throw new Error('retryable_external: OpenAI ranking is unreachable')
      }
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const retryable = isRetryableHttpStatus(response.status)
        throw new Error(
          retryable
            ? 'retryable_external: OpenAI ranking is temporarily unavailable'
            : 'needs_user: OpenAI ranking configuration needs attention',
        )
      }
      const text = openAIOutputText(payload) ?? ''
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error(
          'needs_user: OpenAI ranking returned invalid structured output',
        )
      }
      const dto = normalizeRankingDto(parsed, candidateIds)
      if (!dto)
        throw new Error(
          'needs_user: OpenAI ranking returned unsafe candidate data',
        )
      return dto
    },
  }
}
