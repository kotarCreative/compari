'use node'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { getAgentMailPort } from './adapters/agentMail'
import { inboxClientId, safeExternalError } from './domain/inboxProvisioning'

export const provisionUserInbox = internalAction({
  args: { userId: v.id('users'), jobId: v.id('sideEffectJobs') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(
      internal.agentMailJobs.claimProvisioning,
      args,
    )
    if (!claim) return null
    try {
      const inbox = await getAgentMailPort().provisionInbox({
        username: claim.username,
        displayName: claim.displayName,
        clientId: inboxClientId(args.userId),
      })
      await ctx.runMutation(internal.agentMailJobs.completeProvisioning, {
        ...args,
        claimToken: claim.claimToken,
        inboxId: inbox.inboxId,
        emailAddress: inbox.emailAddress,
      })
    } catch (error) {
      await ctx.runMutation(internal.agentMailJobs.failProvisioning, {
        ...args,
        claimToken: claim.claimToken,
        ...safeExternalError(error),
      })
    }
    return null
  },
})
