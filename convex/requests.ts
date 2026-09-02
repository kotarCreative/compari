import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { requireCurrentUser, requireOwnedRequest } from './lib/auth'
import { canResearch, transitionRequest } from './domain/workflowState'
import type { FunctionReference } from 'convex/server'
import type { Doc, Id } from './_generated/dataModel'

const requestSummary = v.object({
  _id: v.id('procurementRequests'),
  prompt: v.string(),
  title: v.string(),
  location: v.optional(v.string()),
  status: v.union(
    v.literal('draft'),
    v.literal('researching'),
    v.literal('contacting'),
    v.literal('collecting_responses'),
    v.literal('evaluating'),
    v.literal('awaiting_selection'),
    v.literal('completed'),
    v.literal('cancelled'),
  ),
  automationPaused: v.boolean(),
  version: v.number(),
  researchStatus: v.union(
    v.literal('not_started'),
    v.literal('in_progress'),
    v.literal('complete'),
    v.literal('empty'),
  ),
  candidateCounts: v.object({
    discovered: v.number(),
    researching: v.number(),
    qualified: v.number(),
    rejected: v.number(),
    queuedForContact: v.number(),
    contacted: v.number(),
    responded: v.number(),
  }),
  createdAt: v.number(),
  updatedAt: v.number(),
})

function toRequestSummary(request: Doc<'procurementRequests'>) {
  return {
    _id: request._id,
    prompt: request.prompt,
    title: request.title,
    ...(request.location === undefined ? {} : { location: request.location }),
    status: request.status,
    automationPaused: request.automationPaused,
    version: request.version,
    researchStatus: request.researchStatus,
    candidateCounts: request.candidateCounts,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  }
}

function toActivitySummary(event: Doc<'activityEvents'>) {
  return {
    _id: event._id,
    requestId: event.requestId,
    ...(event.candidateId === undefined
      ? {}
      : { candidateId: event.candidateId }),
    eventType: event.eventType,
    safeMessage: event.safeMessage,
    correlationId: event.correlationId,
    createdAt: event.createdAt,
  }
}

const workflow = internal as unknown as {
  workflows: {
    extractRequirements: FunctionReference<
      'action',
      'internal',
      { requestId: Id<'procurementRequests'>; jobId: Id<'sideEffectJobs'> },
      null
    >
  }
}

export const create = mutation({
  args: { prompt: v.string() },
  returns: v.id('procurementRequests'),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    if (user.nameConfirmedAt === undefined)
      throw new Error('validation: confirm your name before comparing')
    const prompt = args.prompt.trim()
    if (prompt.length < 12 || prompt.length > 8_000)
      throw new Error(
        'validation: describe the outcome in 12 to 8000 characters',
      )
    const now = Date.now()
    const requestId = await ctx.db.insert('procurementRequests', {
      userId: user._id,
      prompt,
      title: 'New procurement request',
      status: 'draft',
      automationPaused: false,
      version: 1,
      researchStatus: 'not_started',
      candidateCounts: {
        discovered: 0,
        researching: 0,
        qualified: 0,
        rejected: 0,
        queuedForContact: 0,
        contacted: 0,
        responded: 0,
      },
      createdAt: now,
      updatedAt: now,
    })
    const jobId = await ctx.db.insert('sideEffectJobs', {
      userId: user._id,
      kind: 'extract_requirements',
      idempotencyKey: `extract-requirements:${requestId}:v1`,
      status: 'pending',
      attemptCount: 0,
      maxAttempts: 3,
      requestId,
      inputVersion: 1,
      scheduledAt: now,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('activityEvents', {
      requestId,
      eventType: 'request_created',
      safeMessage: 'Request created; interpreting requirements.',
      correlationId: String(jobId),
      createdAt: now,
    })
    await ctx.scheduler.runAfter(0, workflow.workflows.extractRequirements, {
      requestId,
      jobId,
    })
    return requestId
  },
})

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(requestSummary),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const result = await ctx.db
      .query('procurementRequests')
      .withIndex('by_user_id_and_updated_at', (q) => q.eq('userId', user._id))
      .order('desc')
      .paginate(args.paginationOpts)
    return { ...result, page: result.page.map(toRequestSummary) }
  },
})
export const get = query({
  args: { requestId: v.id('procurementRequests') },
  returns: v.union(v.null(), requestSummary),
  handler: async (ctx, args) => {
    const { request } = await requireOwnedRequest(ctx, args.requestId)
    return toRequestSummary(request)
  },
})
export const cancel = mutation({
  args: { requestId: v.id('procurementRequests') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { request } = await requireOwnedRequest(ctx, args.requestId)
    if (request.status === 'completed' || request.status === 'cancelled')
      throw new Error(
        'validation: completed or cancelled requests cannot be cancelled',
      )
    transitionRequest(request.status, 'cancelled')
    const now = Date.now()
    await ctx.db.patch('procurementRequests', request._id, {
      status: 'cancelled',
      updatedAt: now,
    })
    await ctx.db.insert('activityEvents', {
      requestId: request._id,
      eventType: 'request_cancelled',
      safeMessage: 'Automation cancelled by buyer.',
      correlationId: `request:${request._id}:cancel`,
      createdAt: now,
    })
    return null
  },
})
export const pauseAutomation = mutation({
  args: { requestId: v.id('procurementRequests') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { request } = await requireOwnedRequest(ctx, args.requestId)
    if (request.status === 'cancelled' || request.status === 'completed')
      throw new Error('validation: automation cannot be paused now')
    await ctx.db.patch('procurementRequests', request._id, {
      automationPaused: true,
      updatedAt: Date.now(),
    })
    return null
  },
})
export const resumeAutomation = mutation({
  args: { requestId: v.id('procurementRequests') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { request } = await requireOwnedRequest(ctx, args.requestId)
    if (request.status === 'cancelled' || request.status === 'completed')
      throw new Error('validation: automation cannot be resumed now')
    if (!request.automationPaused)
      throw new Error('validation: automation is already running')
    const now = Date.now()
    const nextVersion = request.version + 1
    await ctx.db.patch('procurementRequests', request._id, {
      automationPaused: false,
      version: nextVersion,
      updatedAt: now,
    })
    const existing = await ctx.db
      .query('sideEffectJobs')
      .withIndex('by_idempotency_key', (q) =>
        q.eq(
          'idempotencyKey',
          `extract-requirements:${request._id}:v${nextVersion}`,
        ),
      )
      .unique()
    if (!existing) {
      const jobId = await ctx.db.insert('sideEffectJobs', {
        userId: request.userId,
        kind: 'extract_requirements',
        idempotencyKey: `extract-requirements:${request._id}:v${nextVersion}`,
        status: 'pending',
        attemptCount: 0,
        maxAttempts: 3,
        requestId: request._id,
        inputVersion: nextVersion,
        scheduledAt: now,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.scheduler.runAfter(0, workflow.workflows.extractRequirements, {
        requestId: request._id,
        jobId,
      })
    }
    return null
  },
})
export const retryIntake = mutation({
  args: { requestId: v.id('procurementRequests') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { request } = await requireOwnedRequest(ctx, args.requestId)
    if (request.status !== 'draft' || request.automationPaused)
      throw new Error('validation: request intake cannot be retried now')
    const job = await ctx.db
      .query('sideEffectJobs')
      .withIndex('by_idempotency_key', (q) =>
        q.eq(
          'idempotencyKey',
          `extract-requirements:${request._id}:v${request.version}`,
        ),
      )
      .unique()
    if (
      !job ||
      (job.status !== 'permanent_failure' && job.status !== 'needs_user')
    )
      throw new Error('validation: request intake does not need a retry')
    const now = Date.now()
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: 'pending',
      attemptCount: 0,
      lastErrorCategory: undefined,
      lastErrorSummary: undefined,
      scheduledAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('activityEvents', {
      requestId: request._id,
      eventType: 'request_intake_retried',
      safeMessage: 'Request interpretation was retried by the buyer.',
      correlationId: String(job._id),
      createdAt: now,
    })
    await ctx.scheduler.runAfter(0, workflow.workflows.extractRequirements, {
      requestId: request._id,
      jobId: job._id,
    })
    return null
  },
})
export const activity = query({
  args: {
    requestId: v.id('procurementRequests'),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(
    v.object({
      _id: v.id('activityEvents'),
      requestId: v.id('procurementRequests'),
      candidateId: v.optional(v.id('requestCandidates')),
      eventType: v.string(),
      safeMessage: v.string(),
      correlationId: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOwnedRequest(ctx, args.requestId)
    const result = await ctx.db
      .query('activityEvents')
      .withIndex('by_request_id_and_created_at', (q) =>
        q.eq('requestId', args.requestId),
      )
      .order('desc')
      .paginate(args.paginationOpts)
    return { ...result, page: result.page.map(toActivitySummary) }
  },
})

export const beginResearchIfUseful = mutation({
  args: { requestId: v.id('procurementRequests') },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const { request } = await requireOwnedRequest(ctx, args.requestId)
    if (!canResearch(request.prompt) || request.status !== 'draft') return false
    transitionRequest('draft', 'researching')
    await ctx.db.patch('procurementRequests', request._id, {
      status: 'researching',
      researchStatus: 'in_progress',
      updatedAt: Date.now(),
    })
    return true
  },
})
