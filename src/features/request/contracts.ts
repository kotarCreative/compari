import { api } from '../../../convex/_generated/api'
import type { FunctionReference } from 'convex/server'

export type Json = { schemaVersion: 1; value: unknown }

export type RequestDetailValue = {
  request: {
    _id: string
    prompt: string
    title: string
    location?: string
    status: string
    automationPaused: boolean
    version: number
    interpretedVersion?: number
    researchStatus: string
    rankingStatus?: string
    rankingError?: string
    rankingVersion?: number
    candidateCounts: {
      discovered: number
      researching: number
      qualified: number
      rejected: number
      queuedForContact: number
      contacted: number
      responded: number
    }
  }
  requirements: Array<{
    _id: string
    key: string
    label: string
    value: Json
    kind: 'hard_constraint' | 'preference' | 'information'
    source: string
    importance?: number
    confidence: number
  }>
  questions: Array<{
    _id: string
    candidateId?: string
    text: string
    importance: string
    status: string
    answer?: string
  }>
  candidates: Array<{
    _id: string
    name: string
    website: string
    status: string
    qualificationSummary?: string
    rejectionSummary?: string
    shortlistReason?: string
    recommendationStatus?: string
    recommendationScore?: number
    recommendationReason?: string
    recommendationCaveats?: Array<string>
    endpoints: Array<{
      _id: string
      type: string
      value: string
      verificationState: string
      evidenceUrl: string
    }>
    facts: Array<{
      _id: string
      key: string
      label: string
      value: Json
      sourceType: string
      sourceUrl?: string
      excerpt?: string
      confidence: number
      observedAt: number
    }>
  }>
  outreach: Array<{
    _id: string
    candidateId: string
    method: string
    status: string
    contentSummary: string
    safeError?: string
    updatedAt: number
  }>
  conversations: Array<{
    _id: string
    candidateId: string
    status: string
    lastMessageAt?: number
    messages: Array<{
      _id: string
      direction: string
      participants: Array<string>
      subject: string
      sanitizedBody: string
      occurredAt: number
      agentMailMessageId: string
    }>
  }>
}

export type Proposal = {
  _id: string
  candidateId: string
  status: string
  summary: string
  confidence: number
  version: number
  attributes: Json
}

export type RequestDiagnostics = {
  requestStatus: string
  candidates: Array<{
    _id: string
    status: string
    qualificationSummary?: string
  }>
  conversations: Array<{
    _id: string
    candidateId: string
    status: string
    lastMessageAt?: number
  }>
  jobs: Array<{
    _id: string
    kind: string
    status: string
    attemptCount: number
    lastErrorCategory?: string
    lastErrorSummary?: string
    updatedAt: number
  }>
  events: Array<{
    eventType: string
    safeMessage: string
    correlationId: string
    createdAt: number
  }>
}

export const productApi = api as unknown as {
  requestDetails: {
    get: FunctionReference<
      'query',
      'public',
      { requestId: string },
      RequestDetailValue
    >
  }
  requirements: {
    upsert: FunctionReference<
      'mutation',
      'public',
      {
        requestId: string
        key: string
        label: string
        value: Json
        kind: 'hard_constraint' | 'preference' | 'information'
        importance?: number
      },
      string
    >
    remove: FunctionReference<
      'mutation',
      'public',
      { requirementId: string },
      null
    >
  }
  questions: {
    answerForRequest: FunctionReference<
      'mutation',
      'public',
      { questionId: string; answer: string },
      null
    >
  }
  requests: {
    pauseAutomation: FunctionReference<
      'mutation',
      'public',
      { requestId: string },
      null
    >
    resumeAutomation: FunctionReference<
      'mutation',
      'public',
      { requestId: string },
      null
    >
    retryIntake: FunctionReference<
      'mutation',
      'public',
      { requestId: string },
      null
    >
    retryDiscovery: FunctionReference<
      'mutation',
      'public',
      { requestId: string },
      null
    >
    cancel: FunctionReference<'mutation', 'public', { requestId: string }, null>
  }
  outreach: {
    selectCandidates: FunctionReference<
      'mutation',
      'public',
      { requestId: string; candidateIds: Array<string> },
      null
    >
    retryFailed: FunctionReference<
      'mutation',
      'public',
      { attemptId: string },
      null
    >
  }
  proposals: {
    list: FunctionReference<
      'query',
      'public',
      { requestId: string },
      Array<Proposal>
    >
  }
  diagnostics: {
    getRequest: FunctionReference<
      'query',
      'public',
      { requestId: string },
      RequestDiagnostics
    >
  }
}
