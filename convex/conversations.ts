import { paginationOptsValidator, paginationResultValidator } from 'convex/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, mutation, query } from './_generated/server'
import { requireOwnedRequest } from './lib/auth'

const conversationValidator = v.object({
  _id: v.id('conversations'),
  requestId: v.id('procurementRequests'),
  candidateId: v.id('requestCandidates'),
  status: v.union(v.literal('active'), v.literal('waiting_on_provider'), v.literal('waiting_on_user'), v.literal('completed')),
  lastMessageAt: v.optional(v.number()),
})
const messageValidator = v.object({
  _id: v.id('providerMessages'),
  conversationId: v.id('conversations'),
  direction: v.union(v.literal('inbound'), v.literal('outbound')),
  participants: v.array(v.string()),
  subject: v.string(),
  sanitizedBody: v.string(),
  agentMailMessageId: v.string(),
  occurredAt: v.number(),
  createdAt: v.number(),
})

export const list = query({
  args: { requestId: v.id('procurementRequests') },
  returns: v.array(conversationValidator),
  handler: async (ctx, args) => {
    await requireOwnedRequest(ctx, args.requestId)
    return await ctx.db.query('conversations').withIndex('by_request_id_and_candidate_id', (q) => q.eq('requestId', args.requestId)).take(100)
  },
})

export const get = query({
  args: { conversationId: v.id('conversations'), paginationOpts: paginationOptsValidator },
  returns: v.object({ conversation: conversationValidator, messages: paginationResultValidator(messageValidator) }),
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get('conversations', args.conversationId)
    if (!conversation) throw new Error('validation: conversation does not exist')
    await requireOwnedRequest(ctx, conversation.requestId)
    return {
      conversation,
      messages: await ctx.db.query('providerMessages').withIndex('by_conversation_id_and_created_at', (q) => q.eq('conversationId', conversation._id)).order('desc').paginate(args.paginationOpts),
    }
  },
})

export const resolveRouting = mutation({
  args: { eventId: v.id('webhookEvents'), candidateId: v.id('requestCandidates') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get('webhookEvents', args.eventId)
    const candidate = await ctx.db.get('requestCandidates', args.candidateId)
    if (!event || !candidate) throw new Error('validation: routing target does not exist')
    const { request, user } = await requireOwnedRequest(ctx, candidate.requestId)
    if (event.status !== 'needs_user') throw new Error('validation: routing has already been resolved')
    if (!event.inboxId || event.inboxId !== user.agentMailInboxId)
      throw new Error('authorization: webhook inbox does not belong to this buyer')
    const byThread = event.threadId
      ? await ctx.db.query('conversations').withIndex('by_agent_mail_thread_id', (q) => q.eq('agentMailThreadId', event.threadId!)).unique()
      : null
    if (byThread && (byThread.requestId !== request._id || byThread.candidateId !== candidate._id))
      throw new Error('validation: webhook thread belongs to a different request')
    await ctx.db.patch('webhookEvents', event._id, { proposedCandidateId: candidate._id, status: 'pending', safeError: undefined })
    // The processor intentionally needs the full message body from AgentMail; do not
    // retain an untrusted body in the event record merely to make resolution convenient.
    await ctx.scheduler.runAfter(0, internal.webhookProcessor.process, { eventId: event._id })
    return null
  },
})

/** Internal-only normalized boundary used by a verified webhook processor or demo port. */
export const ingestProviderMessage = internalMutation({
  args: {
    externalEventId: v.string(), inboxId: v.string(), threadId: v.string(), messageId: v.string(),
    sender: v.string(), subject: v.string(), body: v.string(), occurredAt: v.number(),
    attachments: v.optional(v.array(v.object({ id: v.string(), filename: v.optional(v.string()), contentType: v.optional(v.string()), size: v.optional(v.number()) }))),
    candidateId: v.optional(v.id('requestCandidates')),
  },
  returns: v.union(v.null(), v.id('providerMessages')),
  handler: async (ctx, args) => {
    const duplicate = await ctx.db.query('webhookEvents').withIndex('by_provider_and_external_event_id', (q) => q.eq('provider', 'agentmail').eq('externalEventId', args.externalEventId)).unique()
    if (duplicate) return null
    const now = Date.now()
    const eventId = await ctx.db.insert('webhookEvents', { provider: 'agentmail', externalEventId: args.externalEventId, status: 'running', attemptCount: 1, eventType: 'message.received', inboxId: args.inboxId, threadId: args.threadId, messageId: args.messageId, proposedCandidateId: args.candidateId, receivedAt: now })
    const existingMessage = await ctx.db.query('providerMessages').withIndex('by_external_message_id', (q) => q.eq('agentMailMessageId', args.messageId)).unique()
    if (existingMessage) {
      await ctx.db.patch('webhookEvents', eventId, { status: 'succeeded', processedAt: now })
      return null
    }
    let conversation = await ctx.db.query('conversations').withIndex('by_agent_mail_thread_id', (q) => q.eq('agentMailThreadId', args.threadId)).unique()
    const candidate = args.candidateId ? await ctx.db.get('requestCandidates', args.candidateId) : null
    if (conversation && candidate && (conversation.candidateId !== candidate._id || conversation.requestId !== candidate.requestId)) {
      await ctx.db.patch('webhookEvents', eventId, { status: 'needs_user', safeError: 'Thread and proposed candidate do not match.' })
      return null
    }
    if (!conversation && candidate) {
      const request = await ctx.db.get('procurementRequests', candidate.requestId)
      const user = request ? await ctx.db.get('users', request.userId) : null
      if (request && user && user.agentMailInboxId === args.inboxId) {
        conversation = await ctx.db.insert('conversations', { requestId: request._id, candidateId: candidate._id, inboxId: args.inboxId, agentMailThreadId: args.threadId, status: 'active', createdAt: now, updatedAt: now }).then((id) => ctx.db.get('conversations', id))
      }
    }
    if (!conversation || conversation.inboxId !== args.inboxId) {
      await ctx.db.patch('webhookEvents', eventId, { status: 'needs_user', safeError: 'Routing needs buyer confirmation.' })
      return null
    }
    const messageId = await ctx.db.insert('providerMessages', { conversationId: conversation._id, direction: 'inbound', participants: [args.sender.slice(0, 320)], subject: args.subject.slice(0, 500), sanitizedBody: args.body.slice(0, 40_000), agentMailMessageId: args.messageId, attachments: { schemaVersion: 1, value: args.attachments ?? [] }, occurredAt: args.occurredAt, createdAt: now })
    await ctx.db.patch('conversations', conversation._id, { status: 'active', lastMessageAt: args.occurredAt, lastInboundMessageId: messageId, updatedAt: now })
    await ctx.db.patch('webhookEvents', eventId, { status: 'succeeded', processedAt: now })
    await ctx.scheduler.runAfter(0, internal.reasoningWorkflow.extractProviderMessage, { providerMessageId: messageId })
    return messageId
  },
})

/** Delivery events are operational health only; they never become provider content. */
export const reconcileDeliveryEvent = internalMutation({
  args: { messageId: v.string(), eventType: v.union(v.literal('message.delivered'), v.literal('message.bounced'), v.literal('message.complained'), v.literal('message.rejected')) }, returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.query('outreachAttempts').withIndex('by_vendor_message_id', (q) => q.eq('vendorMessageId', args.messageId)).unique()
    if (!attempt) return null
    const now = Date.now()
    if (args.eventType === 'message.delivered') {
      if (attempt.status === 'pending' || attempt.status === 'running') await ctx.db.patch('outreachAttempts', attempt._id, { status: 'succeeded', updatedAt: now })
      return null
    }
    await ctx.db.patch('outreachAttempts', attempt._id, { status: 'needs_user', safeError: 'Provider mail delivery reported a bounce, complaint, or rejection.', updatedAt: now })
    return null
  },
})
