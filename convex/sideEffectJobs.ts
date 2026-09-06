import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import {
  canClaimJob,
  canRetryJob,
  retryDelayMs,
} from './domain/sideEffectPolicy'

const kind = v.union(
  v.literal('extract_requirements'),
  v.literal('discover_providers'),
  v.literal('research_candidate'),
  v.literal('rank_candidates'),
  v.literal('send_outreach_email'),
  v.literal('submit_contact_form'),
  v.literal('process_inbound_message'),
  v.literal('extract_provider_response'),
  v.literal('send_follow_up'),
  v.literal('evaluate_request'),
  v.literal('demo_flow'),
)

/** Atomically leases a pending/retryable job. Callers must only persist a result
 * while the job remains running with this token. */
export const claim = internalMutation({
  args: { jobId: v.id('sideEffectJobs'), kind },
  returns: v.union(v.null(), v.object({ claimToken: v.string() })),
  handler: async (ctx, args) => {
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (!job || job.kind !== args.kind) return null
    const now = Date.now()
    if (!canClaimJob(job, now)) return null
    const claimToken = crypto.randomUUID()
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: 'running',
      claimToken,
      claimedAt: now,
      leaseExpiresAt: now + 60_000,
      attemptCount: job.attemptCount + 1,
      updatedAt: now,
    })
    return { claimToken }
  },
})

export const retryOrFail = internalMutation({
  args: {
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
    summary: v.string(),
    retryable: v.boolean(),
    retryAfterMs: v.optional(v.number()),
  },
  returns: v.union(v.null(), v.object({ retryAt: v.optional(v.number()) })),
  handler: async (ctx, args) => {
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (!job || job.status !== 'running' || job.claimToken !== args.claimToken)
      return null
    const now = Date.now()
    const canRetry = canRetryJob({
      retryable: args.retryable,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
    })
    const retryAt = canRetry
      ? now + retryDelayMs(job.attemptCount, args.retryAfterMs)
      : undefined
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: canRetry ? 'retryable_failure' : 'permanent_failure',
      lastErrorCategory: canRetry ? 'retryable_external' : 'permanent_external',
      lastErrorSummary: args.summary.slice(0, 300),
      scheduledAt: retryAt,
      claimToken: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    })
    return retryAt === undefined ? null : { retryAt }
  },
})

export const complete = internalMutation({
  args: { jobId: v.id('sideEffectJobs'), claimToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (!job || job.status !== 'running' || job.claimToken !== args.claimToken)
      return null
    const now = Date.now()
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: 'succeeded',
      completedAt: now,
      claimToken: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    })
    return null
  },
})

/** Schedules the same durable job after retryOrFail has atomically persisted it. */
export const scheduleRetry = internalMutation({
  args: { jobId: v.id('sideEffectJobs'), retryAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      !job ||
      job.status !== 'retryable_failure' ||
      job.scheduledAt !== args.retryAt
    )
      return null
    const delay = Math.max(0, args.retryAt - Date.now())
    switch (job.kind) {
      case 'extract_requirements':
        if (job.requestId)
          await ctx.scheduler.runAfter(
            delay,
            internal.workflows.extractRequirements,
            {
              requestId: job.requestId,
              jobId: job._id,
            },
          )
        break
      case 'discover_providers':
        if (job.requestId)
          await ctx.scheduler.runAfter(
            delay,
            internal.workflows.discoverProviders,
            {
              requestId: job.requestId,
              jobId: job._id,
            },
          )
        break
      case 'research_candidate':
        if (job.candidateId)
          await ctx.scheduler.runAfter(
            delay,
            internal.workflows.researchCandidate,
            {
              candidateId: job.candidateId,
              jobId: job._id,
            },
          )
        break
      case 'rank_candidates':
        if (job.requestId)
          await ctx.scheduler.runAfter(delay, internal.rankingWorkflow.rank, {
            requestId: job.requestId,
            jobId: job._id,
          })
        break
      case 'send_outreach_email':
      case 'submit_contact_form':
        if (job.outreachAttemptId)
          await ctx.scheduler.runAfter(
            delay,
            internal.outreachWorkflow.execute,
            {
              attemptId: job.outreachAttemptId,
              jobId: job._id,
            },
          )
        break
      case 'evaluate_request':
        if (job.requestId)
          await ctx.scheduler.runAfter(
            delay,
            internal.evaluationsWorkflow.generate,
            {
              requestId: job.requestId,
              jobId: job._id,
            },
          )
        break
      case 'send_follow_up':
        if (job.questionId)
          await ctx.scheduler.runAfter(
            delay,
            internal.followUps.sendForAnsweredQuestion,
            {
              questionId: job.questionId,
              jobId: job._id,
            },
          )
        break
      case 'extract_provider_response': {
        if (!job.requestId || !job.candidateId) break
        const requestId = job.requestId
        const candidateId = job.candidateId
        const conversation = await ctx.db
          .query('conversations')
          .withIndex('by_request_id_and_candidate_id', (q) =>
            q.eq('requestId', requestId).eq('candidateId', candidateId),
          )
          .unique()
        if (!conversation) break
        const messages = await ctx.db
          .query('providerMessages')
          .withIndex('by_conversation_id_and_created_at', (q) =>
            q.eq('conversationId', conversation._id),
          )
          .order('desc')
          .take(20)
        const message = messages.find(
          (item) => item.direction === 'inbound' && !item.extractionVersion,
        )
        if (message)
          await ctx.scheduler.runAfter(
            delay,
            internal.reasoningWorkflow.extractProviderMessage,
            { providerMessageId: message._id, jobId: job._id },
          )
        break
      }
      default:
        return null
    }
    return null
  },
})
