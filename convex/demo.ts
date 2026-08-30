import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation } from './_generated/server'
import { requireCurrentUser } from './lib/auth'

export const start = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    await ctx.scheduler.runAfter(0, internal.demoActions.run, {
      userId: user._id,
    })
    return null
  },
})
