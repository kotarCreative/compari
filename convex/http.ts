import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { auth } from './auth'
import { isFreshSvixTimestamp, readSvixHeaders } from './domain/webhook'

const http = httpRouter()
auth.addHttpRoutes(http)
// This endpoint deliberately fails closed until the Svix package is installed in
// the deployment. Raw bytes and headers are read before any parsing/persistence;
// accepting an unsigned webhook would be worse than requesting a retry.
http.route({
  path: '/webhooks/agentmail',
  method: 'POST',
  handler: httpAction(async (_ctx, request) => {
    await request.bytes()
    const headers = readSvixHeaders(request.headers)
    if (!headers || !isFreshSvixTimestamp(headers.timestamp, Date.now()))
      return new Response('missing, invalid, or stale webhook signature headers', { status: 400 })
    return new Response('Svix verification is not installed; webhook rejected', { status: 503 })
  }),
})
export default http
