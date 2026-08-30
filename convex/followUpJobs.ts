import { v } from 'convex/values'
import { internalMutation, internalQuery } from './_generated/server'
import { canProcessFollowUp } from './domain/followUpPolicy'

const jobArgs = { questionId: v.id('questions'), jobId: v.id('sideEffectJobs'), claimToken: v.string() }

/** Loads only the exact question/job/conversation relationship leased by the action. */
export const load = internalQuery({
  args: jobArgs,
  returns: v.union(v.null(), v.object({ inboxId: v.string(), parentMessageId: v.string(), answer: v.string(), idempotencyKey: v.string(), requestActive: v.boolean(), paused: v.boolean(), hasExactUserFact: v.boolean(), confidence: v.number() })),
  handler: async (ctx, args) => {
    const question = await ctx.db.get('questions', args.questionId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (!question || !job) return null
    if (!canProcessFollowUp({ jobKind: job.kind, jobQuestionId: job.questionId,
      questionId: question._id, jobRequestId: job.requestId, questionRequestId: question.requestId,
      jobCandidateId: job.candidateId, questionCandidateId: question.candidateId,
      status: job.status, claimMatches: job.claimToken === args.claimToken,
      questionStatus: question.status }) || !question.answer || !question.providerMessageId || !question.candidateId) return null
    const message = await ctx.db.get('providerMessages', question.providerMessageId)
    const candidate = await ctx.db.get('requestCandidates', question.candidateId)
    const request = candidate ? await ctx.db.get('procurementRequests', candidate.requestId) : null
    const conversation = message ? await ctx.db.get('conversations', message.conversationId) : null
    if (!message || !candidate || !request || !conversation || job.inputVersion !== request.version || candidate.requestId !== request._id ||
      conversation.requestId !== request._id || conversation.candidateId !== candidate._id) return null
    const supporting = await Promise.all(question.supportingFactIds.slice(0, 8).map((id) => ctx.db.get('facts', id)))
    const hasExactUserFact = supporting.some((fact) => fact?.requestId === request._id && fact.sourceType === 'user')
    return { inboxId: conversation.inboxId, parentMessageId: message.agentMailMessageId,
      answer: question.answer, idempotencyKey: job.idempotencyKey,
      requestActive: request.status !== 'cancelled' && request.status !== 'completed', paused: request.automationPaused,
      hasExactUserFact, confidence: hasExactUserFact ? 1 : 0 }
  },
})

export const block = internalMutation({
  args: { ...jobArgs, reason: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const question = await ctx.db.get('questions', args.questionId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (!question || !job || job.questionId !== question._id || job.status !== 'running' || job.claimToken !== args.claimToken) return null
    const now = Date.now()
    if (question.candidateId) {
      const conversation = await ctx.db.query('conversations').withIndex('by_request_id_and_candidate_id', (q) => q.eq('requestId', question.requestId).eq('candidateId', question.candidateId!)).unique()
      if (conversation) await ctx.db.patch('conversations', conversation._id, { status: 'waiting_on_user', updatedAt: now })
    }
    await ctx.db.patch('sideEffectJobs', job._id, { status: 'needs_user', lastErrorCategory: 'needs_user', lastErrorSummary: args.reason.slice(0, 300), claimToken: undefined, leaseExpiresAt: undefined, updatedAt: now })
    return null
  },
})

export const complete = internalMutation({
  args: { ...jobArgs, messageId: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const question = await ctx.db.get('questions', args.questionId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (!question || !job || !question.candidateId || job.questionId !== question._id ||
      job.status !== 'running' || job.claimToken !== args.claimToken || question.status !== 'answered') return null
    const conversation = await ctx.db.query('conversations').withIndex('by_request_id_and_candidate_id', (q) => q.eq('requestId', question.requestId).eq('candidateId', question.candidateId!)).unique()
    if (!conversation) return null
    const now = Date.now()
    const existing = await ctx.db.query('providerMessages').withIndex('by_external_message_id', (q) => q.eq('agentMailMessageId', args.messageId)).unique()
    if (!existing) await ctx.db.insert('providerMessages', { conversationId: conversation._id, direction: 'outbound', participants: [], subject: 'Re: provider question', sanitizedBody: question.answer ?? '', agentMailMessageId: args.messageId, attachments: { schemaVersion: 1, value: [] }, occurredAt: now, createdAt: now })
    await ctx.db.patch('conversations', conversation._id, { status: 'waiting_on_provider', lastMessageAt: now, updatedAt: now })
    await ctx.db.patch('questions', question._id, { status: 'resolved', updatedAt: now })
    await ctx.db.patch('sideEffectJobs', job._id, { status: 'succeeded', completedAt: now, claimToken: undefined, leaseExpiresAt: undefined, updatedAt: now })
    return null
  },
})
