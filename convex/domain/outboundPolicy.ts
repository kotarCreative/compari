const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const commitment = /\b(accept|agree|book|purchase|pay(?:ment)?|sign|contract)\b/i
const secret = /\b(api[ _-]?key|password|secret|access[ _-]?token|bearer)\b/i
const personalData = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{3}-\d{2}-\d{4}\b/i

export type OutboundPreflight = {
  requestStatus: string
  requestVersion: number
  jobInputVersion?: number
  paused: boolean
  candidateQueued: boolean
  endpointType: 'email' | 'form'
  endpointVerified: boolean
  endpointValue: string
  stableReplyAddress?: string
  previousSucceeded: boolean
  withinCap: boolean
  subject: string
  body: string
}

/** Reject any message that can no longer be proven to be a bounded factual ask. */
export function validateOutboundPreflight(input: OutboundPreflight): string | null {
  if (input.paused || !['researching', 'contacting'].includes(input.requestStatus))
    return 'request is not permitted to contact providers'
  if (input.jobInputVersion !== input.requestVersion)
    return 'outreach input is stale'
  if (!input.candidateQueued || !input.endpointVerified || input.previousSucceeded)
    return 'outreach relationship or endpoint is no longer eligible'
  if (!input.withinCap) return 'ranked shortlist contact cap reached'
  if (!input.stableReplyAddress || !email.test(input.stableReplyAddress))
    return 'stable agent reply address is unavailable'
  if (input.endpointType === 'email' && !email.test(input.endpointValue))
    return 'email endpoint is invalid'
  if (input.endpointType === 'form' && !/^https:\/\//i.test(input.endpointValue))
    return 'form endpoint is invalid'
  if (!input.subject.trim() || input.subject.length > 180 || input.body.length > 2_000)
    return 'message scope exceeds policy bounds'
  if (commitment.test(`${input.subject}\n${input.body}`))
    return 'message contains a commitment'
  if (secret.test(`${input.subject}\n${input.body}`) || personalData.test(input.body))
    return 'message includes restricted data'
  return null
}

export function classifyExternalError(error: unknown): {
  retryable: boolean
  summary: string
} {
  const summary = error instanceof Error ? error.message.slice(0, 300) : 'external operation failed'
  return {
    retryable: /^retryable_external:/i.test(summary) || /\b(timeout|rate limit|temporar)/i.test(summary),
    summary: summary.replace(/^(retryable_external|permanent_external|needs_user):\s*/i, ''),
  }
}
