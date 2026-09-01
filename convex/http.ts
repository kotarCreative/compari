import { httpRouter } from 'convex/server'
import { internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { auth } from './auth'
import {
  isFreshSvixTimestamp,
  normalizeVerifiedAgentMailEvent,
  readSvixHeaders,
  verifySvixSignature,
} from './domain/webhook'

declare const process: { env: Record<string, string | undefined> }

const http = httpRouter()
auth.addHttpRoutes(http)
http.route({
  path: '/webhooks/agentmail',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text()
    const headers = readSvixHeaders(request.headers)
    if (!headers || !isFreshSvixTimestamp(headers.timestamp, Date.now()))
      return new Response(
        'missing, invalid, or stale webhook signature headers',
        { status: 400 },
      )
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET
    if (!secret)
      return new Response('webhook verification is not configured', {
        status: 503,
      })
    if (!(await verifySvixSignature(rawBody, headers, secret)))
      return new Response('invalid webhook signature', { status: 401 })
    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return new Response('invalid webhook payload', { status: 400 })
    }
    const event = normalizeVerifiedAgentMailEvent(payload)
    if (!event)
      return new Response('unsupported webhook payload', { status: 400 })
    await ctx.runMutation(internal.webhookEvents.recordVerified, {
      externalEventId: headers.id,
      eventType: event.eventType,
      ...(event.inboxId === undefined ? {} : { inboxId: event.inboxId }),
      ...(event.threadId === undefined ? {} : { threadId: event.threadId }),
      ...(event.messageId === undefined ? {} : { messageId: event.messageId }),
    })
    return new Response(null, { status: 202 })
  }),
})
export default http
