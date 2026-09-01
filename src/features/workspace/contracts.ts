import { api } from '../../../convex/_generated/api'
import type { FunctionReference } from 'convex/server'

export type Profile = {
  name?: string
  email?: string
  agentEmailAddress?: string
  inboxProvisioningStatus?:
    | 'pending'
    | 'provisioning'
    | 'ready'
    | 'retryable_failure'
    | 'permanent_failure'
  inboxProvisioningError?: string
  inboxProvisioningAttempts?: number
}

type NoArgs = Record<string, never>

export type RequestList = {
  page: Array<{
    _id: string
    title: string
    prompt: string
    status: string
    researchStatus: string
    automationPaused: boolean
    candidateCounts: { discovered: number; qualified: number; rejected: number }
  }>
  continueCursor: string
  isDone: boolean
}

export const usersApi = api as unknown as {
  users: {
    ensureCurrentUser: FunctionReference<'mutation', 'public', NoArgs, string>
    current: FunctionReference<'query', 'public', NoArgs, Profile | null>
    retryMyInboxProvisioning: FunctionReference<
      'mutation',
      'public',
      NoArgs,
      null
    >
  }
}

export const requestsApi = api as unknown as {
  requests: {
    create: FunctionReference<'mutation', 'public', { prompt: string }, string>
    list: FunctionReference<
      'query',
      'public',
      { paginationOpts: { numItems: number; cursor: string | null } },
      RequestList
    >
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
  }
}
