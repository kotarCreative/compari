'use node'
import { deterministicRanking, normalizeRankingDto, rankingSystemInstruction } from '../domain/ranking'
import type { RankingPort } from '../ports/ranking'

declare const process: { env: Record<string, string | undefined> }

export function getRankingPort(): RankingPort {
  return { rank: async (input) => {
    if (process.env.COMPARI_DEMO_MODE === 'true') return deterministicRanking(input.candidates.map(x => x.candidateId))
    const key = process.env.OPENAI_API_KEY
    if (!key) throw new Error('needs_user: OpenAI ranking is not configured')
    const candidateIds = new Set(input.candidates.map(x => x.candidateId))
    const schema = {
      type: 'object', additionalProperties: false, required: ['schemaVersion', 'rankings'],
      properties: {
        schemaVersion: { const: 1 },
        rankings: { type: 'array', maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['candidateId', 'score', 'reason', 'caveats'], properties: { candidateId: { type: 'string' }, score: { type: 'number', minimum: 0, maximum: 100 }, reason: { type: 'string', maxLength: 500 }, caveats: { type: 'array', maxItems: 4, items: { type: 'string', maxLength: 240 } } } } },
      },
    }
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4.1-mini', store: false,
        input: [{ role: 'system', content: rankingSystemInstruction }, { role: 'user', content: JSON.stringify(input).slice(0, 24_000) }],
        text: { format: { type: 'json_schema', name: 'candidate_ranking', strict: true, schema } },
      }),
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500
      throw new Error(retryable ? 'retryable_external: OpenAI ranking is temporarily unavailable' : 'needs_user: OpenAI ranking configuration needs attention')
    }
    const text = payload && typeof payload === 'object' && typeof (payload as { output_text?: unknown }).output_text === 'string' ? (payload as { output_text: string }).output_text : ''
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { throw new Error('needs_user: OpenAI ranking returned invalid structured output') }
    const dto = normalizeRankingDto(parsed, candidateIds)
    if (!dto) throw new Error('needs_user: OpenAI ranking returned unsafe candidate data')
    return dto
  } }
}
