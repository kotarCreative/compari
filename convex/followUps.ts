'use node'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { getAgentMailPort } from './adapters/agentMail'
import { answerEligible } from './domain/reasoning'

export const sendForAnsweredQuestion = internalAction({
  args: { questionId: v.id('questions'), jobId: v.id('sideEffectJobs') }, returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(internal.sideEffectJobs.claim, { jobId: args.jobId, kind: 'send_follow_up' })
    if (!claim) return null
    const payload = await ctx.runQuery(internal.followUpJobs.load, { ...args, claimToken: claim.claimToken })
    if (!payload) {
      await ctx.runMutation(internal.followUpJobs.block, { ...args, claimToken: claim.claimToken, reason: 'Follow-up input is stale or no longer belongs to this conversation.' })
      return null
    }
    const allowed = answerEligible({ requestActive: payload.requestActive, paused: payload.paused, hasUserFact: payload.hasExactUserFact, confidence: payload.confidence, answer: payload.answer })
    if (!allowed) { await ctx.runMutation(internal.followUpJobs.block, { ...args, claimToken: claim.claimToken, reason: 'A precise buyer fact and high-confidence factual answer are required.' }); return null }
    try {
      const result = await getAgentMailPort().replyToMessage({ inboxId: payload.inboxId, parentMessageId: payload.parentMessageId, text: payload.answer, idempotencyKey: payload.idempotencyKey })
      await ctx.runMutation(internal.followUpJobs.complete, { ...args, claimToken: claim.claimToken, messageId: result.messageId })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Factual reply delivery failed.'
      const retryable = /timeout|rate limit|temporar/i.test(message)
      if (retryable) {
        const failure = await ctx.runMutation(internal.sideEffectJobs.retryOrFail, { jobId: args.jobId, claimToken: claim.claimToken, retryable: true, summary: message })
        if (failure?.retryAt) await ctx.runMutation(internal.sideEffectJobs.scheduleRetry, { jobId: args.jobId, retryAt: failure.retryAt })
      } else await ctx.runMutation(internal.followUpJobs.block, { ...args, claimToken: claim.claimToken, reason: 'Factual reply awaits a reconciled AgentMail delivery adapter.' })
    }
    return null
  },
})
