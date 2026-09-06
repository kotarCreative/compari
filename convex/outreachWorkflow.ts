'use node'

import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { getAgentMailPort } from './adapters/agentMail'
import { getReasoningPort } from './adapters/reasoning'
import { classifyExternalError } from './domain/outboundPolicy'

export const execute = internalAction({
  args: { attemptId: v.id('outreachAttempts'), jobId: v.id('sideEffectJobs') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const emailClaim = await ctx.runMutation(internal.sideEffectJobs.claim, {
      jobId: args.jobId,
      kind: 'send_outreach_email',
    })
    const claim =
      emailClaim ??
      (await ctx.runMutation(internal.sideEffectJobs.claim, {
        jobId: args.jobId,
        kind: 'submit_contact_form',
      }))
    if (!claim) return null
    const payload = await ctx.runQuery(internal.outreachWorkflowState.load, {
      ...args,
      claimToken: claim.claimToken,
    })
    if (!payload) {
      await ctx.runMutation(internal.sideEffectJobs.retryOrFail, {
        jobId: args.jobId,
        claimToken: claim.claimToken,
        retryable: false,
        summary: 'permanent: outreach preflight rejected stale or unsafe input',
      })
      return null
    }
    if (payload.method !== 'email') {
      await ctx.runMutation(internal.outreachWorkflowState.block, {
        ...args,
        claimToken: claim.claimToken,
        retryable: false,
        summary: 'needs_user: form submission is not safely configured',
      })
      return null
    }
    try {
      const draft =
        payload.draft ??
        (await getReasoningPort().composeOutreachEmail(payload.composition))
      if (!payload.draft) {
        const saved = await ctx.runMutation(
          internal.outreachWorkflowState.saveDraft,
          {
            ...args,
            claimToken: claim.claimToken,
            subject: draft.subject,
            body: draft.body,
          },
        )
        if (!saved) {
          await ctx.runMutation(internal.outreachWorkflowState.block, {
            ...args,
            claimToken: claim.claimToken,
            retryable: false,
            summary: 'Generated outreach did not pass the final safety check',
          })
          return null
        }
      }
      const result = await getAgentMailPort().sendMessage({
        inboxId: payload.inboxId,
        to: payload.endpoint,
        subject: draft.subject,
        text: draft.body,
        idempotencyKey: payload.idempotencyKey,
      })
      await ctx.runMutation(internal.outreachWorkflowState.complete, {
        ...args,
        claimToken: claim.claimToken,
        messageId: result.messageId,
        threadId: result.threadId,
        subject: draft.subject,
        body: draft.body,
      })
    } catch (error) {
      const failure = classifyExternalError(error)
      await ctx.runMutation(internal.outreachWorkflowState.block, {
        ...args,
        claimToken: claim.claimToken,
        retryable: failure.retryable,
        summary: failure.summary,
      })
    }
    return null
  },
})
