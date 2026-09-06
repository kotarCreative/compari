import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, internalQuery } from './_generated/server'
import { validateOutboundPreflight } from './domain/outboundPolicy'
import { canRetryJob, retryDelayMs } from './domain/sideEffectPolicy'
import {
  moveCandidateCount,
  transitionCandidate,
  transitionRequest,
} from './domain/workflowState'

const actionArgs = {
  attemptId: v.id('outreachAttempts'),
  jobId: v.id('sideEffectJobs'),
  claimToken: v.string(),
}

const outreachRequirement = v.object({
  label: v.string(),
  value: v.string(),
  kind: v.union(
    v.literal('hard_constraint'),
    v.literal('preference'),
    v.literal('information'),
  ),
})

const outreachDraft = v.object({ subject: v.string(), body: v.string() })

export const load = internalQuery({
  args: actionArgs,
  returns: v.union(
    v.null(),
    v.object({
      method: v.union(v.literal('email'), v.literal('form')),
      inboxId: v.string(),
      endpoint: v.string(),
      idempotencyKey: v.string(),
      draft: v.optional(outreachDraft),
      composition: v.object({
        originalRequest: v.string(),
        requestTitle: v.string(),
        location: v.optional(v.string()),
        buyerName: v.string(),
        providerName: v.string(),
        requirements: v.array(outreachRequirement),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get('outreachAttempts', args.attemptId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      !attempt ||
      !job ||
      attempt.jobId !== job._id ||
      (attempt.status !== 'pending' &&
        attempt.status !== 'retryable_failure') ||
      job.status !== 'running' ||
      job.claimToken !== args.claimToken ||
      job.outreachAttemptId !== attempt._id ||
      job.requestId !== attempt.requestId ||
      job.candidateId !== attempt.candidateId
    )
      return null
    const request = await ctx.db.get('procurementRequests', attempt.requestId)
    const candidate = await ctx.db.get('requestCandidates', attempt.candidateId)
    const endpoint = await ctx.db.get('contactEndpoints', attempt.endpointId)
    const user = request ? await ctx.db.get('users', request.userId) : null
    const business = candidate
      ? await ctx.db.get('businesses', candidate.businessId)
      : null
    if (
      !request ||
      !candidate ||
      !endpoint ||
      !user ||
      !business ||
      request.automationPaused ||
      !['researching', 'contacting'].includes(request.status) ||
      candidate.status !== 'queued_for_contact' ||
      !user.agentMailInboxId ||
      !user.name ||
      user.nameConfirmedAt === undefined ||
      endpoint.type !== (attempt.method === 'email' ? 'email' : 'contact_form')
    )
      return null
    const [queued, contacted, previousSucceeded, requirements] =
      await Promise.all([
        ctx.db
          .query('requestCandidates')
          .withIndex('by_request_id_and_status', (q) =>
            q.eq('requestId', request._id).eq('status', 'queued_for_contact'),
          )
          .take(6),
        ctx.db
          .query('requestCandidates')
          .withIndex('by_request_id_and_status', (q) =>
            q.eq('requestId', request._id).eq('status', 'contacted'),
          )
          .take(6),
        ctx.db
          .query('outreachAttempts')
          .withIndex('by_candidate_id_and_status', (q) =>
            q.eq('candidateId', candidate._id).eq('status', 'succeeded'),
          )
          .first(),
        ctx.db
          .query('requirements')
          .withIndex('by_request_id', (q) => q.eq('requestId', request._id))
          .take(30),
      ])
    const existingDraft =
      attempt.draftSubject && attempt.draftBody
        ? { subject: attempt.draftSubject, body: attempt.draftBody }
        : undefined
    const preflightDraft = existingDraft ?? {
      subject: `Question about ${request.title}`.slice(0, 100),
      body: `I’m helping ${user.name} gather information about ${request.title.toLowerCase()}. Could you let me know if your team may be able to help?`,
    }
    if (
      validateOutboundPreflight({
        requestStatus: request.status,
        requestVersion: request.version,
        jobInputVersion: job.inputVersion,
        paused: request.automationPaused,
        candidateQueued: true,
        endpointType: attempt.method,
        endpointVerified:
          endpoint.verificationState === 'public' ||
          endpoint.verificationState === 'verified',
        endpointValue: endpoint.value,
        stableReplyAddress: user.agentEmailAddress,
        previousSucceeded: Boolean(previousSucceeded),
        withinCap: queued.length + contacted.length <= 5,
        subject: preflightDraft.subject,
        body: preflightDraft.body,
      })
    )
      return null
    return {
      method: attempt.method,
      inboxId: user.agentMailInboxId,
      endpoint: endpoint.value,
      idempotencyKey: job.idempotencyKey,
      draft: existingDraft,
      composition: {
        originalRequest: request.prompt.slice(0, 4_000),
        requestTitle: request.title.slice(0, 120),
        location: request.location,
        buyerName: user.name.slice(0, 160),
        providerName: business.canonicalName.slice(0, 160),
        requirements: requirements.map((item) => ({
          label: item.label.slice(0, 160),
          value: displayRequirementValue(item.value.value).slice(0, 1_000),
          kind: item.kind,
        })),
      },
    }
  },
})

/** Persist the exact reviewed draft before the external send. A retry reuses
 * these bytes with the same idempotency key instead of generating a different
 * message that could be recorded against the first provider response. */
export const saveDraft = internalMutation({
  args: { ...actionArgs, subject: v.string(), body: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get('outreachAttempts', args.attemptId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      !attempt ||
      !job ||
      attempt.jobId !== job._id ||
      (attempt.status !== 'pending' &&
        attempt.status !== 'retryable_failure') ||
      job.status !== 'running' ||
      job.claimToken !== args.claimToken ||
      job.outreachAttemptId !== attempt._id ||
      job.requestId !== attempt.requestId ||
      job.candidateId !== attempt.candidateId
    )
      return false
    if (attempt.draftSubject || attempt.draftBody)
      return (
        attempt.draftSubject === args.subject && attempt.draftBody === args.body
      )
    const request = await ctx.db.get('procurementRequests', attempt.requestId)
    const candidate = await ctx.db.get('requestCandidates', attempt.candidateId)
    const endpoint = await ctx.db.get('contactEndpoints', attempt.endpointId)
    const user = request ? await ctx.db.get('users', request.userId) : null
    if (
      !request ||
      !candidate ||
      !endpoint ||
      !user?.agentMailInboxId ||
      !user.agentEmailAddress ||
      request.automationPaused ||
      !['researching', 'contacting'].includes(request.status) ||
      candidate.status !== 'queued_for_contact' ||
      endpoint.type !== (attempt.method === 'email' ? 'email' : 'contact_form')
    )
      return false
    const [queued, contacted, previousSucceeded] = await Promise.all([
      ctx.db
        .query('requestCandidates')
        .withIndex('by_request_id_and_status', (q) =>
          q.eq('requestId', request._id).eq('status', 'queued_for_contact'),
        )
        .take(6),
      ctx.db
        .query('requestCandidates')
        .withIndex('by_request_id_and_status', (q) =>
          q.eq('requestId', request._id).eq('status', 'contacted'),
        )
        .take(6),
      ctx.db
        .query('outreachAttempts')
        .withIndex('by_candidate_id_and_status', (q) =>
          q.eq('candidateId', candidate._id).eq('status', 'succeeded'),
        )
        .first(),
    ])
    const rejection = validateOutboundPreflight({
      requestStatus: request.status,
      requestVersion: request.version,
      jobInputVersion: job.inputVersion,
      paused: request.automationPaused,
      candidateQueued: true,
      endpointType: attempt.method,
      endpointVerified:
        endpoint.verificationState === 'public' ||
        endpoint.verificationState === 'verified',
      endpointValue: endpoint.value,
      stableReplyAddress: user.agentEmailAddress,
      previousSucceeded: Boolean(previousSucceeded),
      withinCap: queued.length + contacted.length <= 5,
      subject: args.subject,
      body: args.body,
    })
    if (rejection) return false
    await ctx.db.patch('outreachAttempts', attempt._id, {
      draftSubject: args.subject,
      draftBody: args.body,
      contentSummary: `Personalized information request: ${args.subject}`.slice(
        0,
        500,
      ),
      updatedAt: Date.now(),
    })
    return true
  },
})

export const complete = internalMutation({
  args: {
    ...actionArgs,
    messageId: v.string(),
    threadId: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get('outreachAttempts', args.attemptId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      !attempt ||
      !job ||
      attempt.jobId !== job._id ||
      job.status !== 'running' ||
      job.claimToken !== args.claimToken ||
      job.outreachAttemptId !== attempt._id ||
      job.requestId !== attempt.requestId ||
      job.candidateId !== attempt.candidateId ||
      attempt.draftSubject !== args.subject ||
      attempt.draftBody !== args.body ||
      (attempt.status !== 'pending' && attempt.status !== 'retryable_failure')
    )
      return null
    const request = await ctx.db.get('procurementRequests', attempt.requestId)
    const candidate = await ctx.db.get('requestCandidates', attempt.candidateId)
    const endpoint = await ctx.db.get('contactEndpoints', attempt.endpointId)
    if (
      !request ||
      !candidate ||
      !endpoint ||
      request.automationPaused ||
      request.version !== job.inputVersion ||
      candidate.status !== 'queued_for_contact' ||
      endpoint.type !== 'email' ||
      (endpoint.verificationState !== 'public' &&
        endpoint.verificationState !== 'verified')
    )
      return null
    const user = await ctx.db.get('users', request.userId)
    if (!user?.agentMailInboxId) return null
    const now = Date.now()
    transitionCandidate('queued_for_contact', 'contacted')
    await ctx.db.patch('outreachAttempts', attempt._id, {
      status: 'succeeded',
      vendorMessageId: args.messageId,
      updatedAt: now,
    })
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: 'succeeded',
      completedAt: now,
      claimToken: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    })
    await ctx.db.patch('requestCandidates', candidate._id, {
      status: 'contacted',
      updatedAt: now,
    })
    let conversation = await ctx.db
      .query('conversations')
      .withIndex('by_request_id_and_candidate_id', (q) =>
        q.eq('requestId', request._id).eq('candidateId', candidate._id),
      )
      .unique()
    if (!conversation) {
      const conversationId = await ctx.db.insert('conversations', {
        requestId: request._id,
        candidateId: candidate._id,
        inboxId: user.agentMailInboxId,
        agentMailThreadId: args.threadId,
        status: 'waiting_on_provider',
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      })
      conversation = await ctx.db.get('conversations', conversationId)
    } else {
      await ctx.db.patch('conversations', conversation._id, {
        agentMailThreadId: args.threadId,
        status: 'waiting_on_provider',
        lastMessageAt: now,
        updatedAt: now,
      })
    }
    if (conversation) {
      const existingMessage = await ctx.db
        .query('providerMessages')
        .withIndex('by_external_message_id', (q) =>
          q.eq('agentMailMessageId', args.messageId),
        )
        .unique()
      if (!existingMessage)
        await ctx.db.insert('providerMessages', {
          conversationId: conversation._id,
          direction: 'outbound',
          participants: [endpoint.value],
          subject: args.subject.slice(0, 500),
          sanitizedBody: args.body.slice(0, 2_000),
          agentMailMessageId: args.messageId,
          attachments: { schemaVersion: 1, value: [] },
          occurredAt: now,
          createdAt: now,
        })
    }
    await ctx.db.patch('procurementRequests', request._id, {
      candidateCounts: moveCandidateCount(
        request.candidateCounts,
        'queuedForContact',
        'contacted',
      ),
      updatedAt: now,
    })
    const unsettled = await ctx.db
      .query('outreachAttempts')
      .withIndex('by_request_id_and_status', (q) =>
        q.eq('requestId', request._id).eq('status', 'pending'),
      )
      .take(1)
    const retrying = await ctx.db
      .query('outreachAttempts')
      .withIndex('by_request_id_and_status', (q) =>
        q.eq('requestId', request._id).eq('status', 'retryable_failure'),
      )
      .take(1)
    if (
      request.status === 'contacting' &&
      !unsettled.length &&
      !retrying.length
    ) {
      transitionRequest('contacting', 'collecting_responses')
      await ctx.db.patch('procurementRequests', request._id, {
        status: 'collecting_responses',
        updatedAt: now,
      })
    }
    return null
  },
})

function displayRequirementValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return 'Provided by the buyer'
  }
}

export const block = internalMutation({
  args: { ...actionArgs, retryable: v.boolean(), summary: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get('outreachAttempts', args.attemptId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      !attempt ||
      !job ||
      attempt.jobId !== job._id ||
      job.status !== 'running' ||
      job.claimToken !== args.claimToken ||
      (attempt.status !== 'pending' && attempt.status !== 'retryable_failure')
    )
      return null
    const now = Date.now()
    const retryable = canRetryJob({
      retryable: args.retryable,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
    })
    const retryAt = retryable ? now + retryDelayMs(job.attemptCount) : undefined
    await ctx.db.patch('outreachAttempts', attempt._id, {
      status: retryable ? 'retryable_failure' : 'needs_user',
      safeError: args.summary.slice(0, 300),
      updatedAt: now,
    })
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: retryable ? 'retryable_failure' : 'needs_user',
      lastErrorCategory: retryable ? 'retryable_external' : 'needs_user',
      lastErrorSummary: args.summary.slice(0, 300),
      scheduledAt: retryAt,
      claimToken: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    })
    if (retryAt)
      await ctx.scheduler.runAfter(
        retryAt - now,
        internal.outreachWorkflow.execute,
        { attemptId: attempt._id, jobId: job._id },
      )
    if (!retryAt) {
      const request = await ctx.db.get('procurementRequests', attempt.requestId)
      if (request?.status === 'contacting') {
        const [pending, retrying] = await Promise.all([
          ctx.db
            .query('outreachAttempts')
            .withIndex('by_request_id_and_status', (q) =>
              q.eq('requestId', request._id).eq('status', 'pending'),
            )
            .take(1),
          ctx.db
            .query('outreachAttempts')
            .withIndex('by_request_id_and_status', (q) =>
              q.eq('requestId', request._id).eq('status', 'retryable_failure'),
            )
            .take(1),
        ])
        if (!pending.length && !retrying.length) {
          transitionRequest('contacting', 'collecting_responses')
          await ctx.db.patch('procurementRequests', request._id, {
            status: 'collecting_responses',
            updatedAt: now,
          })
        }
      }
    }
    return null
  },
})
