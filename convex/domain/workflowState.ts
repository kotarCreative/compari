export type RequestStatus =
  | 'draft'
  | 'researching'
  | 'contacting'
  | 'collecting_responses'
  | 'evaluating'
  | 'awaiting_selection'
  | 'completed'
  | 'cancelled'
export type CandidateStatus =
  | 'discovered'
  | 'researching'
  | 'qualified'
  | 'rejected'
  | 'queued_for_contact'
  | 'contacted'
  | 'responded'
  | 'proposal_received'
  | 'declined'

const requestTransitions: Record<
  RequestStatus,
  ReadonlyArray<RequestStatus>
> = {
  draft: ['researching', 'cancelled'],
  researching: ['contacting', 'evaluating', 'cancelled'],
  contacting: ['collecting_responses', 'cancelled'],
  collecting_responses: ['contacting', 'evaluating', 'cancelled'],
  evaluating: ['awaiting_selection', 'cancelled'],
  awaiting_selection: ['contacting', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
}
const candidateTransitions: Record<
  CandidateStatus,
  ReadonlyArray<CandidateStatus>
> = {
  discovered: ['researching'],
  researching: ['qualified', 'rejected'],
  qualified: ['queued_for_contact'],
  rejected: [],
  queued_for_contact: ['contacted'],
  contacted: ['responded'],
  responded: ['proposal_received', 'declined'],
  proposal_received: [],
  declined: [],
}
export function transitionRequest(from: RequestStatus, to: RequestStatus) {
  if (!requestTransitions[from].includes(to))
    throw new Error(
      `validation: request cannot transition from ${from} to ${to}`,
    )
  return to
}
export function transitionCandidate(
  from: CandidateStatus,
  to: CandidateStatus,
) {
  if (!candidateTransitions[from].includes(to))
    throw new Error(
      `validation: candidate cannot transition from ${from} to ${to}`,
    )
  return to
}
export function normalizeDomain(input: string) {
  const url = new URL(input)
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error('validation: website must use http or https')
  return url.hostname.toLowerCase().replace(/^www\./, '')
}
export function normalizedQuestionKey(value: string) {
  return value
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
export function questionsAreSimilar(left: string, right: string) {
  const leftKey = normalizedQuestionKey(left)
  const rightKey = normalizedQuestionKey(right)
  if (leftKey === rightKey) return true
  const ignored = new Set([
    'a',
    'an',
    'and',
    'are',
    'be',
    'do',
    'does',
    'for',
    'is',
    'of',
    'or',
    'should',
    'that',
    'the',
    'to',
    'what',
    'which',
    'your',
  ])
  const tokens = (key: string) =>
    new Set(key.split(' ').filter((token) => token && !ignored.has(token)))
  const leftTokens = tokens(leftKey)
  const rightTokens = tokens(rightKey)
  let shared = 0
  for (const token of leftTokens) if (rightTokens.has(token)) shared++
  const smallerSize = Math.min(leftTokens.size, rightTokens.size)
  if (smallerSize === 0) return false
  if (smallerSize === 1)
    return shared === 1 && leftTokens.size === rightTokens.size
  return shared >= 2 && shared / smallerSize >= 0.75
}

export function validateBoundedJson(value: unknown) {
  if (!isBoundedJson(value, 0))
    throw new Error('validation: value has unsupported JSON structure')
  let text: string
  try {
    text = JSON.stringify(value)
  } catch {
    throw new Error('validation: value must be serializable')
  }
  if (text.length > 20_000) throw new Error('validation: value is too large')
  return value
}
function isBoundedJson(value: unknown, depth: number): boolean {
  if (
    depth > 8 ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  )
    return depth <= 8 && (typeof value !== 'string' || value.length <= 8_000)
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value))
    return (
      value.length <= 100 &&
      value.every((item) => isBoundedJson(item, depth + 1))
    )
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    return (
      entries.length <= 100 &&
      entries.every(
        ([key, item]) => key.length <= 100 && isBoundedJson(item, depth + 1),
      )
    )
  }
  return false
}
export function canResearch(prompt: string) {
  return prompt.trim().length >= 12
}

export type CandidateCounts = {
  discovered: number
  researching: number
  qualified: number
  rejected: number
  queuedForContact: number
  contacted: number
  responded: number
}

export function moveCandidateCount(
  counts: CandidateCounts,
  from: keyof CandidateCounts,
  to: keyof CandidateCounts,
): CandidateCounts {
  return {
    ...counts,
    [from]: Math.max(0, counts[from] - 1),
    [to]: counts[to] + 1,
  }
}
