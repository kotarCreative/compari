import { v } from 'convex/values'
import { query } from './_generated/server'
import { requireOwnedRequest } from './lib/auth'

export const getRequest = query({
  args: { requestId: v.id('procurementRequests') },
  returns: v.object({
    requestStatus: v.string(),
    candidates: v.array(v.object({ _id: v.id('requestCandidates'), status: v.string(), qualificationSummary: v.optional(v.string()) })),
    conversations: v.array(v.object({ _id: v.id('conversations'), candidateId: v.id('requestCandidates'), status: v.string(), lastMessageAt: v.optional(v.number()) })),
    jobs: v.array(v.object({ _id: v.id('sideEffectJobs'), kind: v.string(), status: v.string(), attemptCount: v.number(), lastErrorCategory: v.optional(v.string()), lastErrorSummary: v.optional(v.string()), updatedAt: v.number() })),
    events: v.array(v.object({ eventType: v.string(), safeMessage: v.string(), correlationId: v.string(), createdAt: v.number() })),
  }),
  handler: async (ctx, args) => {
    const { request } = await requireOwnedRequest(ctx, args.requestId)
    const candidates = await ctx.db.query('requestCandidates').withIndex('by_request_id', (q) => q.eq('requestId', request._id)).take(30)
    const conversations = await ctx.db.query('conversations').withIndex('by_request_id_and_candidate_id', (q) => q.eq('requestId', request._id)).take(30)
    const jobs = await ctx.db.query('sideEffectJobs').withIndex('by_request_id_and_created_at', (q) => q.eq('requestId', request._id)).order('desc').take(30)
    const events = await ctx.db.query('activityEvents').withIndex('by_request_id_and_created_at', (q) => q.eq('requestId', request._id)).order('desc').take(30)
    return {
      requestStatus: request.status,
      candidates: candidates.map((candidate) => ({ _id: candidate._id, status: candidate.status, qualificationSummary: candidate.qualificationSummary })),
      conversations: conversations.map((conversation) => ({ _id: conversation._id, candidateId: conversation.candidateId, status: conversation.status, lastMessageAt: conversation.lastMessageAt })),
      jobs: jobs.map((job) => ({ _id: job._id, kind: job.kind, status: job.status, attemptCount: job.attemptCount, lastErrorCategory: job.lastErrorCategory, lastErrorSummary: job.lastErrorSummary, updatedAt: job.updatedAt })),
      events: events.map((event) => ({ eventType: event.eventType, safeMessage: event.safeMessage, correlationId: event.correlationId, createdAt: event.createdAt })),
    }
  },
})
