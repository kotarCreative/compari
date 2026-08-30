import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import { normalizeTrustedViews } from './domain/decision'
import { transitionRequest } from './domain/workflowState'
import { requireOwnedRequest } from './lib/auth'

const viewInput = v.object({ type: v.string(), label: v.string(), metricKeys: v.optional(v.array(v.string())), candidateIds: v.optional(v.array(v.string())), explanation: v.optional(v.string()) })

export const list = query({
  args: { requestId: v.id('procurementRequests') },
  returns: v.object({ evaluation: v.union(v.null(), v.object({ _id: v.id('evaluations'), inputVersion: v.number(), recommendation: v.string(), results: v.any(), generatedAt: v.number() })), views: v.array(v.object({ _id: v.id('uiViews'), label: v.string(), viewType: v.string(), configuration: v.any(), inputVersion: v.number() })) }),
  handler: async (ctx, args) => {
    const { request } = await requireOwnedRequest(ctx, args.requestId)
    const inputVersion = request.evaluationInputVersion ?? request.version
    const evaluation = await ctx.db.query('evaluations').withIndex('by_request_id_and_input_version', (q) => q.eq('requestId', args.requestId).eq('inputVersion', inputVersion)).unique()
    const views = await ctx.db.query('uiViews').withIndex('by_request_id_and_input_version', (q) => q.eq('requestId', args.requestId).eq('inputVersion', inputVersion)).take(4)
    return { evaluation: evaluation ? { _id: evaluation._id, inputVersion: evaluation.inputVersion, recommendation: evaluation.recommendation, results: evaluation.results, generatedAt: evaluation.generatedAt } : null, views: views.map((view) => ({ _id: view._id, label: view.label, viewType: view.viewType, configuration: view.configuration, inputVersion: view.inputVersion })) }
  },
})

export const reconfigure = mutation({
  args: { requestId: v.id('procurementRequests'), instruction: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const { request } = await requireOwnedRequest(ctx, args.requestId)
    const instruction = args.instruction.trim()
    if (!instruction || instruction.length > 500) throw new Error('validation: provide a short comparison preference')
    const now = Date.now(); const nextVersion = (request.evaluationInputVersion ?? request.version) + 1
    await ctx.db.patch('procurementRequests', request._id, { evaluationPreference: instruction, evaluationInputVersion: nextVersion, updatedAt: now })
    const jobId = await ctx.db.insert('sideEffectJobs', { userId: request.userId, kind: 'evaluate_request', idempotencyKey: `evaluate:${request._id}:v${nextVersion}`, status: 'pending', attemptCount: 0, maxAttempts: 2, requestId: request._id, inputVersion: nextVersion, scheduledAt: now, createdAt: now, updatedAt: now })
    await ctx.db.insert('activityEvents', { requestId: request._id, eventType: 'evaluation_reconfigured', safeMessage: 'Comparison preferences were updated; facts and requirements were unchanged.', correlationId: String(jobId), createdAt: now })
    await ctx.scheduler.runAfter(200, internal.evaluationsWorkflow.generate, { requestId: request._id, jobId })
    return null
  },
})

export const loadSnapshot = internalQuery({
  args: { requestId: v.id('procurementRequests'), jobId: v.id('sideEffectJobs'), claimToken: v.string() },
  returns: v.union(v.null(), v.object({ candidates: v.array(v.object({ id: v.string(), name: v.string() })), metrics: v.array(v.object({ key: v.string(), label: v.string(), kind: v.union(v.literal('number'), v.literal('date'), v.literal('text')) })), preference: v.optional(v.string()), requirementCount: v.number(), factCount: v.number(), proposalCount: v.number() })),
  handler: async (ctx, args) => {
    const request = await ctx.db.get('procurementRequests', args.requestId); const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (!request || !job || job.requestId !== request._id || job.status !== 'running' || job.claimToken !== args.claimToken || job.inputVersion !== (request.evaluationInputVersion ?? request.version)) return null
    const candidates = await ctx.db.query('requestCandidates').withIndex('by_request_id', (q) => q.eq('requestId', request._id)).take(20)
    const requirements = await ctx.db.query('requirements').withIndex('by_request_id', (q) => q.eq('requestId', request._id)).take(100)
    const facts = await ctx.db.query('facts').withIndex('by_request_id', (q) => q.eq('requestId', request._id)).take(200)
    const proposals = await ctx.db.query('proposals').withIndex('by_request_id', (q) => q.eq('requestId', request._id)).take(50)
    const hydrated = [] as Array<{ id: string; name: string }>
    for (const candidate of candidates) { const business = await ctx.db.get('businesses', candidate.businessId); if (business) hydrated.push({ id: candidate._id, name: business.canonicalName }) }
    const hasPrice = facts.some((fact) => fact.key === 'price')
    const hasAvailability = facts.some((fact) => fact.key === 'availability')
    return { candidates: hydrated, metrics: [{ key: 'price', label: 'Quoted price', kind: 'number' as const }, { key: 'availability', label: 'Availability', kind: 'text' as const }, { key: 'confidence', label: 'Evidence confidence', kind: 'number' as const }], preference: request.evaluationPreference, requirementCount: requirements.length, factCount: facts.length, proposalCount: proposals.length + (hasPrice && hasAvailability ? 0 : 0) }
  },
})

export const apply = internalMutation({
  args: { requestId: v.id('procurementRequests'), jobId: v.id('sideEffectJobs'), claimToken: v.string(), recommendation: v.string(), views: v.array(viewInput) }, returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get('procurementRequests', args.requestId); const job = await ctx.db.get('sideEffectJobs', args.jobId)
    const inputVersion = request?.evaluationInputVersion ?? request?.version
    if (!request || !job || job.status !== 'running' || job.claimToken !== args.claimToken || job.inputVersion !== inputVersion) return null
    const candidateRows = await ctx.db.query('requestCandidates').withIndex('by_request_id', (q) => q.eq('requestId', request._id)).take(20)
    const candidateIds = candidateRows.map((candidate) => candidate._id)
    const metrics = [{ key: 'price', label: 'Quoted price', kind: 'number' as const }, { key: 'availability', label: 'Availability', kind: 'text' as const }, { key: 'confidence', label: 'Evidence confidence', kind: 'number' as const }]
    const views = normalizeTrustedViews(args.views, metrics, candidateIds)
    const now = Date.now()
    const facts = await ctx.db.query('facts').withIndex('by_request_id', (q) => q.eq('requestId', request._id)).take(200)
    const missing = candidateRows.length ? ['Confirm scope, exclusions, and availability against the latest provider response.'] : ['No viable provider response is available.']
    await ctx.db.insert('evaluations', { requestId: request._id, inputVersion: inputVersion ?? request.version, criteria: { schemaVersion: 1, value: metrics }, results: { schemaVersion: 1, value: { candidateIds, evidenceCount: facts.length, caveats: missing, preference: request.evaluationPreference ?? null } }, recommendation: args.recommendation.slice(0, 1_500), generatedAt: now })
    for (const view of views) await ctx.db.insert('uiViews', { requestId: request._id, label: view.label, viewType: view.type, configuration: { schemaVersion: 1, value: view }, inputVersion: inputVersion ?? request.version, generatedAt: now })
    await ctx.db.patch('sideEffectJobs', job._id, { status: 'succeeded', completedAt: now, claimToken: undefined, leaseExpiresAt: undefined, updatedAt: now })
    if (candidateIds.length && request.status === 'evaluating') {
      transitionRequest('evaluating', 'awaiting_selection')
      await ctx.db.patch('procurementRequests', request._id, { status: 'awaiting_selection', updatedAt: now })
    }
    return null
  },
})
