import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { getAgentMailPort } from './adapters/agentMail'
import { classifyExternalError } from './domain/outboundPolicy'

export const process = internalAction({
  args: { eventId: v.id('webhookEvents') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.runMutation(
      internal.webhookEvents.claimProcessing,
      args,
    )
    if (!event) return null
    try {
      if (event.eventType === 'message.received') {
        if (!event.inboxId || !event.messageId)
          throw new Error('needs_user: inbound message identifiers are missing')
        const message = await getAgentMailPort().getMessage({
          inboxId: event.inboxId,
          messageId: event.messageId,
        })
        await ctx.runMutation(internal.conversations.ingestProviderMessage, {
          externalEventId: event.externalEventId,
          inboxId: event.inboxId,
          threadId: event.threadId ?? message.threadId,
          messageId: event.messageId,
          sender: message.sender,
          subject: message.subject,
          body: message.body,
          occurredAt: message.occurredAt,
          attachments: message.attachments,
          candidateId: event.proposedCandidateId,
        })
        return null
      }
      if (
        event.messageId &&
        (event.eventType === 'message.delivered' ||
          event.eventType === 'message.bounced' ||
          event.eventType === 'message.complained' ||
          event.eventType === 'message.rejected')
      ) {
        await ctx.runMutation(internal.conversations.reconcileDeliveryEvent, {
          messageId: event.messageId,
          eventType: event.eventType,
        })
      }
      await ctx.runMutation(internal.webhookEvents.completeProcessing, args)
    } catch (error) {
      const failure = classifyExternalError(error)
      const retry = await ctx.runMutation(
        internal.webhookEvents.failProcessing,
        {
          ...args,
          retryable: failure.retryable,
          summary: failure.summary,
        },
      )
      if (retry)
        await ctx.scheduler.runAfter(
          retry.retryAfterMs,
          internal.webhookProcessor.process,
          args,
        )
    }
    return null
  },
})
