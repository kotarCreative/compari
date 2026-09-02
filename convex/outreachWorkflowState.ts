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

export const load = internalQuery({
  args: actionArgs,
  returns: v.union(
    v.null(),
    v.object({
      method: v.union(v.literal('email'), v.literal('form')),
      inboxId: v.string(),
      endpoint: v.string(),
      subject: v.string(),
      body: v.string(),
      idempotencyKey: v.string(),
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
    if (
      !request ||
      !candidate ||
      !endpoint ||
      !user ||
      request.automationPaused ||
      !['researching', 'contacting'].includes(request.status) ||
      candidate.status !== 'queued_for_contact' ||
      !user.agentMailInboxId ||
      !user.name ||
      user.nameConfirmedAt === undefined ||
      endpoint.type !== (attempt.method === 'email' ? 'email' : 'contact_form')
    )
      return null
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
    const subject = `Information request: ${request.title}`
    const body = `I’m coordinating options on behalf of a buyer. Could you share price, availability, scope, exclusions, and timing for: ${request.prompt.slice(0, 1200)}\n\nPlease reply to ${user.agentEmailAddress} with factual details only.\n\nThanks,\n${user.name}`
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
        subject,
        body,
      })
    )
      return null
    return {
      method: attempt.method,
      inboxId: user.agentMailInboxId,
      endpoint: endpoint.value,
      subject,
      body,
      idempotencyKey: job.idempotencyKey,
    }
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
