'use node'

import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalAction } from './_generated/server'

declare const process: { env: Record<string, string | undefined> }

/** The mode switch is deployment configuration, never a buyer-supplied flag. */
export const mode = action({
  args: {},
  returns: v.boolean(),
  handler: () => process.env.COMPARI_DEMO_MODE === 'true',
})

export const run = internalAction({
  args: { userId: v.id('users') },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (process.env.COMPARI_DEMO_MODE !== 'true') return null
    await ctx.runMutation(internal.demoJobs.seed, args)
    return null
  },
})
