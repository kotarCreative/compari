export type TrustedViewType =
  | 'recommendation'
  | 'provider_cards'
  | 'comparison_matrix'
  | 'ranking'
  | 'bar'
  | 'timeline'
  | 'difference'
  | 'missing_information'

export type Metric = {
  key: string
  label: string
  kind: 'number' | 'date' | 'text'
}

export type TrustedView = {
  type: TrustedViewType
  label: string
  metricKeys?: Array<string>
  candidateIds?: Array<string>
  explanation?: string
}

const types = new Set<TrustedViewType>([
  'recommendation',
  'provider_cards',
  'comparison_matrix',
  'ranking',
  'bar',
  'timeline',
  'difference',
  'missing_information',
])

/** Converts untrusted model JSON into the intentionally tiny renderer contract. */
export function normalizeTrustedViews(
  input: unknown,
  metrics: Array<Metric>,
  candidateIds: Array<string>,
): Array<TrustedView> {
  const metricKinds = new Map(metrics.map((metric) => [metric.key, metric.kind]))
  const allowedCandidates = new Set(candidateIds)
  if (!Array.isArray(input)) return fallbackViews(metrics)
  const valid = input
    .slice(0, 4)
    .flatMap((row): Array<TrustedView> => {
      if (!isRecord(row) || typeof row.type !== 'string' || !types.has(row.type as TrustedViewType)) return []
      const type = row.type as TrustedViewType
      const label = typeof row.label === 'string' ? row.label.trim().slice(0, 90) : type.replace(/_/g, ' ')
      if (!label) return []
      const metricKeys = Array.isArray(row.metricKeys)
        ? row.metricKeys.filter((key): key is string => typeof key === 'string' && metricKinds.has(key)).slice(0, 6)
        : undefined
      if (type === 'bar' && (!metricKeys?.[0] || metricKinds.get(metricKeys[0]) !== 'number')) return []
      if (type === 'timeline' && (!metricKeys?.[0] || metricKinds.get(metricKeys[0]) !== 'date')) return []
      const ids = Array.isArray(row.candidateIds)
        ? row.candidateIds.filter((id): id is string => typeof id === 'string' && allowedCandidates.has(id)).slice(0, 8)
        : undefined
      return [{
        type,
        label,
        metricKeys,
        candidateIds: ids,
        explanation: typeof row.explanation === 'string' ? row.explanation.slice(0, 500) : undefined,
      }]
    })
  return valid.length >= 2 ? valid : fallbackViews(metrics)
}

export function fallbackViews(metrics: Array<Metric>): Array<TrustedView> {
  return [
    { type: 'provider_cards', label: 'Provider offers' },
    { type: 'comparison_matrix', label: 'Compare available evidence', metricKeys: metrics.slice(0, 4).map((metric) => metric.key) },
  ]
}

export function canAutoReply(input: {
  requestActive: boolean
  paused: boolean
  hasExactUserFact: boolean
  confidence: number
  answer: string
}): { allowed: boolean; reason?: string } {
  if (!input.requestActive || input.paused) return { allowed: false, reason: 'Automation is paused or no longer active.' }
  if (!input.hasExactUserFact) return { allowed: false, reason: 'This answer needs a buyer-provided fact.' }
  if (input.confidence < 0.85) return { allowed: false, reason: 'The factual match is not confident enough.' }
  if (/\b(accept|agree|book|purchase|pay|payment|sign|contract|negotiate|commit)\b/i.test(input.answer))
    return { allowed: false, reason: 'The requested response could create a commitment.' }
  if (input.answer.length === 0 || input.answer.length > 2_000) return { allowed: false, reason: 'The response is not a bounded factual answer.' }
  return { allowed: true }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
