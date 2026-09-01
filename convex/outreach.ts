import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { requireOwnedRequest } from './lib/auth'
import { transitionCandidate, transitionRequest } from './domain/workflowState'
import {
  outreachJobsForSelection,
  validateBuyerSelection,
} from './domain/rankingSelection'

export const selectCandidates = mutation({
  args: {
    requestId: v.id('procurementRequests'),
    candidateIds: v.array(v.id('requestCandidates')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { request, user } = await requireOwnedRequest(ctx, args.requestId)
    if (
      request.automationPaused ||
      request.status !== 'researching' ||
      request.rankingStatus !== 'ready' ||
      request.rankingVersion !== request.version
    )
      throw new Error(
        'validation: current ranked candidate selection is unavailable now',
      )
    if (
      args.candidateIds.length < 1 ||
      args.candidateIds.length > 5 ||
      new Set(args.candidateIds).size !== args.candidateIds.length
    )
      throw new Error(
        'validation: select one to five distinct recommended candidates',
      )
    if (
      !user.agentMailInboxId ||
      !user.agentEmailAddress ||
      user.inboxProvisioningStatus !== 'ready'
    )
      throw new Error(
        'validation: a ready buyer inbox is required before contact',
      )
    const now = Date.now()
    const candidates = await Promise.all(
      args.candidateIds.map((candidateId) =>
        ctx.db.get('requestCandidates', candidateId),
      ),
    )
    const choiceError = validateBuyerSelection({
      requestId: String(request._id),
      candidateIds: args.candidateIds.map(String),
      candidates: candidates
        .filter(
          (candidate): candidate is NonNullable<typeof candidate> =>
            candidate !== null,
        )
        .map((candidate) => ({
          id: String(candidate._id),
          requestId: String(candidate.requestId),
          recommended:
            candidate.status === 'qualified' &&
            candidate.recommendationStatus === 'recommended',
          current: candidate.recommendationVersion === request.version,
          contactable: true,
        })),
    })
    if (choiceError) throw new Error(`validation: ${choiceError}`)
    const selectedCandidateIds = outreachJobsForSelection({
      requestId: String(request._id),
      candidateIds: args.candidateIds.map(String),
      candidates: candidates
        .filter(
          (candidate): candidate is NonNullable<typeof candidate> =>
            candidate !== null,
        )
        .map((candidate) => ({
          id: String(candidate._id),
          requestId: String(candidate.requestId),
          recommended:
            candidate.status === 'qualified' &&
            candidate.recommendationStatus === 'recommended',
          current: candidate.recommendationVersion === request.version,
          contactable: true,
        })),
    })
    if (!selectedCandidateIds.length)
      throw new Error('validation: buyer selection is required before contact')
    for (const candidateId of args.candidateIds) {
      const candidate = await ctx.db.get('requestCandidates', candidateId)
      if (
        !candidate ||
        candidate.requestId !== request._id ||
        candidate.status !== 'qualified' ||
        candidate.recommendationStatus !== 'recommended' ||
        candidate.recommendationVersion !== request.version
      )
        throw new Error(
          'validation: each selected candidate must be a current recommendation for this request',
        )
      const endpoint = await ctx.db
        .query('contactEndpoints')
        .withIndex('by_business_id_and_type', (q) =>
          q.eq('businessId', candidate.businessId).eq('type', 'email'),
        )
        .first()
      if (
        !endpoint ||
        (endpoint.verificationState !== 'public' &&
          endpoint.verificationState !== 'verified')
      )
        throw new Error(
          'validation: each selected candidate needs a verified public email address',
        )
      transitionCandidate('qualified', 'queued_for_contact')
      const jobId = await ctx.db.insert('sideEffectJobs', {
        userId: user._id,
        kind: 'send_outreach_email',
        idempotencyKey: `buyer-selected-outreach:${candidate._id}:v${request.version}`,
        status: 'pending',
        attemptCount: 0,
        maxAttempts: 3,
        requestId: request._id,
        candidateId: candidate._id,
        inputVersion: request.version,
        scheduledAt: now,
        createdAt: now,
        updatedAt: now,
      })
      const attemptId = await ctx.db.insert('outreachAttempts', {
        requestId: request._id,
        candidateId: candidate._id,
        endpointId: endpoint._id,
        method: 'email',
        status: 'pending',
        jobId,
        contentSummary:
          'Buyer selected this evidence-ranked provider for a factual information request.',
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.patch('sideEffectJobs', jobId, {
        outreachAttemptId: attemptId,
      })
      await ctx.db.patch('requestCandidates', candidate._id, {
        status: 'queued_for_contact',
        recommendationStatus: 'selected',
        updatedAt: now,
      })
      await ctx.scheduler.runAfter(0, internal.outreachWorkflow.execute, {
        attemptId,
        jobId,
      })
    }
    transitionRequest('researching', 'contacting')
    await ctx.db.patch('procurementRequests', request._id, {
      status: 'contacting',
      candidateCounts: {
        ...request.candidateCounts,
        qualified: Math.max(
          0,
          request.candidateCounts.qualified - args.candidateIds.length,
        ),
        queuedForContact:
          request.candidateCounts.queuedForContact + args.candidateIds.length,
      },
      updatedAt: now,
    })
    await ctx.db.insert('activityEvents', {
      requestId: request._id,
      eventType: 'buyer_selected_outreach_candidates',
      safeMessage: `${args.candidateIds.length} recommended providers were selected for factual contact.`,
      correlationId: `ranking:${request.rankingVersion ?? request.version}`,
      createdAt: now,
    })
    return null
  },
})

export const listAttempts = query({
  args: {
    requestId: v.id('procurementRequests'),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(
    v.object({
      _id: v.id('outreachAttempts'),
      requestId: v.id('procurementRequests'),
      candidateId: v.id('requestCandidates'),
      endpointId: v.id('contactEndpoints'),
      method: v.union(v.literal('email'), v.literal('form')),
      status: v.union(
        v.literal('pending'),
        v.literal('running'),
        v.literal('succeeded'),
        v.literal('retryable_failure'),
        v.literal('permanent_failure'),
        v.literal('needs_user'),
      ),
      contentSummary: v.string(),
      safeError: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOwnedRequest(ctx, args.requestId)
    const result = await ctx.db
      .query('outreachAttempts')
      .withIndex('by_request_id', (q) => q.eq('requestId', args.requestId))
      .order('desc')
      .paginate(args.paginationOpts)
    return {
      ...result,
      page: result.page.map((attempt) => ({
        _id: attempt._id,
        requestId: attempt.requestId,
        candidateId: attempt.candidateId,
        endpointId: attempt.endpointId,
        method: attempt.method,
        status: attempt.status,
        contentSummary: attempt.contentSummary,
        ...(attempt.safeError === undefined
          ? {}
          : { safeError: attempt.safeError }),
        createdAt: attempt.createdAt,
        updatedAt: attempt.updatedAt,
      })),
    }
  },
})
export const retryFailed = mutation({
  args: { attemptId: v.id('outreachAttempts') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get('outreachAttempts', args.attemptId)
    if (!attempt) throw new Error('validation: outreach attempt does not exist')
    await requireOwnedRequest(ctx, attempt.requestId)
    if (attempt.status !== 'retryable_failure')
      throw new Error('validation: only retryable failures can be retried')
    const job = await ctx.db.get('sideEffectJobs', attempt.jobId)
    if (!job) throw new Error('invariant: outreach job is missing')
    const now = Date.now()
    if (now - job.updatedAt < 10_000)
      throw new Error('validation: retry is rate limited; try again shortly')
    await ctx.db.patch('outreachAttempts', attempt._id, {
      status: 'pending',
      safeError: undefined,
      updatedAt: now,
    })
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: 'pending',
      lastErrorCategory: undefined,
      lastErrorSummary: undefined,
      scheduledAt: now,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.outreachWorkflow.execute, {
      attemptId: attempt._id,
      jobId: job._id,
    })
    return null
  },
})
