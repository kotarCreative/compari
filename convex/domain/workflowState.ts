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

const requestTransitions: Record<RequestStatus, ReadonlyArray<RequestStatus>> = {
  draft: ['researching', 'cancelled'],
  researching: ['contacting', 'cancelled'],
  contacting: ['collecting_responses', 'cancelled'],
  collecting_responses: ['evaluating', 'cancelled'],
  evaluating: ['awaiting_selection', 'cancelled'],
  awaiting_selection: ['completed', 'cancelled'],
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
export function validateBoundedJson(value: unknown) {
  if (!isBoundedJson(value, 0)) throw new Error('validation: value has unsupported JSON structure')
  let text: string
  try { text = JSON.stringify(value) } catch { throw new Error('validation: value must be serializable') }
  if (text.length > 20_000) throw new Error('validation: value is too large')
  return value
}
function isBoundedJson(value: unknown, depth: number): boolean {
  if (depth > 8 || value === null || typeof value === 'string' || typeof value === 'boolean') return depth <= 8 && (typeof value !== 'string' || value.length <= 8_000)
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.length <= 100 && value.every((item) => isBoundedJson(item, depth + 1))
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    return entries.length <= 100 && entries.every(([key, item]) => key.length <= 100 && isBoundedJson(item, depth + 1))
  }
  return false
}
export function canResearch(prompt: string) {
  return prompt.trim().length >= 12
}
