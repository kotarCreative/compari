import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { requireOwnedRequest } from './lib/auth'
import { validateBoundedJson } from './domain/workflowState'
import type { MutationCtx } from './_generated/server'
import type { FunctionReference } from 'convex/server'
import type { Id } from './_generated/dataModel'

const workflow = internal as unknown as {
  workflows: {
    extractRequirements: FunctionReference<
      'action',
      'internal',
      {
        requestId: Id<'procurementRequests'>
        jobId: Id<'sideEffectJobs'>
      },
      null
    >
  }
}

async function queueRefresh(
  ctx: MutationCtx,
  request: {
    _id: Id<'procurementRequests'>
    userId: Id<'users'>
    version: number
  },
  now: number,
) {
  const nextVersion = request.version + 1
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

const value = v.object({ schemaVersion: v.literal(1), value: v.any() })
const kind = v.union(
  v.literal('hard_constraint'),
  v.literal('preference'),
  v.literal('information'),
)
export const list = query({
  args: { requestId: v.id('procurementRequests') },
  returns: v.array(
    v.object({
      _id: v.id('requirements'),
      requestId: v.id('procurementRequests'),
      key: v.string(),
      label: v.string(),
      value,
      kind,
      source: v.union(v.literal('user'), v.literal('inference')),
      importance: v.optional(v.number()),
      confidence: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOwnedRequest(ctx, args.requestId)
    const requirements = await ctx.db
      .query('requirements')
      .withIndex('by_request_id', (q) => q.eq('requestId', args.requestId))
      .take(100)
    return requirements.map((requirement) => ({
      _id: requirement._id,
      requestId: requirement.requestId,
      key: requirement.key,
      label: requirement.label,
      value: requirement.value,
      kind: requirement.kind,
      source: requirement.source,
      ...(requirement.importance === undefined
        ? {}
        : { importance: requirement.importance }),
      confidence: requirement.confidence,
      createdAt: requirement.createdAt,
      updatedAt: requirement.updatedAt,
    }))
  },
})
export const upsert = mutation({
  args: {
    requestId: v.id('procurementRequests'),
    key: v.string(),
    label: v.string(),
    value,
    kind,
    importance: v.optional(v.number()),
  },
  returns: v.id('requirements'),
  handler: async (ctx, args) => {
    const { request } = await requireOwnedRequest(ctx, args.requestId)
    if (!/^[a-z0-9_]{1,64}$/.test(args.key) || args.label.length > 160)
      throw new Error('validation: invalid requirement key or label')
    validateBoundedJson(args.value.value)
    const now = Date.now()
    const existing = await ctx.db
      .query('requirements')
      .withIndex('by_request_id_and_key', (q) =>
        q.eq('requestId', request._id).eq('key', args.key),
      )
      .unique()
    const patch = {
      label: args.label,
      value: args.value,
      kind: args.kind,
      importance: args.importance,
      source: 'user' as const,
      confidence: 1,
      updatedAt: now,
    }
    const id = existing
      ? (await ctx.db.patch('requirements', existing._id, patch), existing._id)
      : await ctx.db.insert('requirements', {
          requestId: request._id,
          key: args.key,
          ...patch,
          createdAt: now,
        })
    await ctx.db.patch('procurementRequests', request._id, {
      version: request.version + 1,
      updatedAt: now,
    })
    await queueRefresh(ctx, request, now)
    return id
  },
})
export const remove = mutation({
  args: { requirementId: v.id('requirements') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get('requirements', args.requirementId)
    if (!requirement) throw new Error('validation: requirement does not exist')
    const { request } = await requireOwnedRequest(ctx, requirement.requestId)
    await ctx.db.delete('requirements', requirement._id)
    const now = Date.now()
    await ctx.db.patch('procurementRequests', request._id, {
      version: request.version + 1,
      updatedAt: now,
    })
    await queueRefresh(ctx, request, now)
    return null
  },
})
