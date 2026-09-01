import { v } from 'convex/values'
import { query } from './_generated/server'
import { requireOwnedRequest } from './lib/auth'

export const list = query({
  args: { requestId: v.id('procurementRequests') },
  returns: v.array(
    v.object({
      _id: v.id('proposals'),
      candidateId: v.id('requestCandidates'),
      status: v.string(),
      summary: v.string(),
      confidence: v.number(),
      version: v.number(),
      attributes: v.object({ schemaVersion: v.literal(1), value: v.any() }),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOwnedRequest(ctx, args.requestId)
    const proposals = await ctx.db
      .query('proposals')
      .withIndex('by_request_id', (q) => q.eq('requestId', args.requestId))
      .order('desc')
      .take(20)
    return proposals.map((proposal) => ({
      _id: proposal._id,
      candidateId: proposal.candidateId,
      status: proposal.status,
      summary: proposal.summary,
      confidence: proposal.confidence,
      version: proposal.version,
      attributes: proposal.attributes,
    }))
  },
})
