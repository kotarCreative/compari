import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'

export const recordVerified = internalMutation({
  args: {
    externalEventId: v.string(),
    eventType: v.string(),
    inboxId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    messageId: v.optional(v.string()),
  },
  returns: v.union(v.null(), v.id('webhookEvents')),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('webhookEvents')
      .withIndex('by_provider_and_external_event_id', (q) =>
        q
          .eq('provider', 'agentmail')
          .eq('externalEventId', args.externalEventId),
      )
      .unique()
    if (existing) return null
    const now = Date.now()
    const eventId = await ctx.db.insert('webhookEvents', {
      provider: 'agentmail',
      externalEventId: args.externalEventId,
      status: 'pending',
      attemptCount: 0,
      eventType: args.eventType.slice(0, 100),
      inboxId: args.inboxId,
      threadId: args.threadId,
      messageId: args.messageId,
      receivedAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.webhookProcessor.process, {
      eventId,
    })
    return eventId
  },
})

export const markNeedsAdapter = internalMutation({
  args: { eventId: v.id('webhookEvents') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get('webhookEvents', args.eventId)
    if (!event || event.status !== 'pending') return null
    await ctx.db.patch('webhookEvents', event._id, {
      status: 'needs_user',
      safeError:
        'Verified event awaits the configured AgentMail message-fetch adapter.',
    })
    return null
  },
})

export const claimProcessing = internalMutation({
  args: { eventId: v.id('webhookEvents') },
  returns: v.union(
    v.null(),
    v.object({
      externalEventId: v.string(),
      eventType: v.string(),
      inboxId: v.optional(v.string()),
      threadId: v.optional(v.string()),
      messageId: v.optional(v.string()),
      proposedCandidateId: v.optional(v.id('requestCandidates')),
    }),
  ),
  handler: async (ctx, args) => {
    const event = await ctx.db.get('webhookEvents', args.eventId)
    if (
      !event ||
      (event.status !== 'pending' && event.status !== 'retryable_failure')
    )
      return null
    await ctx.db.patch('webhookEvents', event._id, {
      status: 'running',
      attemptCount: event.attemptCount + 1,
      safeError: undefined,
    })
    return {
      externalEventId: event.externalEventId,
      eventType: event.eventType ?? '',
      ...(event.inboxId === undefined ? {} : { inboxId: event.inboxId }),
      ...(event.threadId === undefined ? {} : { threadId: event.threadId }),
      ...(event.messageId === undefined ? {} : { messageId: event.messageId }),
      ...(event.proposedCandidateId === undefined
        ? {}
        : { proposedCandidateId: event.proposedCandidateId }),
    }
  },
})

export const completeProcessing = internalMutation({
  args: { eventId: v.id('webhookEvents') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get('webhookEvents', args.eventId)
    if (!event || event.status !== 'running') return null
    await ctx.db.patch('webhookEvents', event._id, {
      status: 'succeeded',
      processedAt: Date.now(),
      safeError: undefined,
    })
    return null
  },
})

export const failProcessing = internalMutation({
  args: {
    eventId: v.id('webhookEvents'),
    retryable: v.boolean(),
    summary: v.string(),
  },
  returns: v.union(v.null(), v.object({ retryAfterMs: v.number() })),
  handler: async (ctx, args) => {
    const event = await ctx.db.get('webhookEvents', args.eventId)
    if (!event || event.status !== 'running') return null
    const canRetry = args.retryable && event.attemptCount < 3
    const retryAfterMs = 1_000 * 2 ** event.attemptCount
    await ctx.db.patch('webhookEvents', event._id, {
      status: canRetry ? 'retryable_failure' : 'needs_user',
      safeError: args.summary.slice(0, 300),
    })
    return canRetry ? { retryAfterMs } : null
  },
})
