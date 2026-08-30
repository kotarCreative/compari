import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'

/** Fetching mail is fail-closed until an AgentMail fetch/reconciliation adapter exists. */
export const process = internalAction({
  args: { eventId: v.id('webhookEvents') }, returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.webhookEvents.markNeedsAdapter, args)
    return null
  },
})
