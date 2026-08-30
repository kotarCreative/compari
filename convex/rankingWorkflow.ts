'use node'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { getRankingPort } from './adapters/ranking'
import { classifyExternalError } from './domain/outboundPolicy'
import type { Id } from './_generated/dataModel'

export const rank = internalAction({
  args: { requestId: v.id('procurementRequests'), jobId: v.id('sideEffectJobs') }, returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(internal.sideEffectJobs.claim, { jobId: args.jobId, kind: 'rank_candidates' })
    if (!claim) return null
    await ctx.runMutation(internal.rankingState.markRunning, { ...args, claimToken: claim.claimToken })
    const snapshot = await ctx.runQuery(internal.rankingState.load, { ...args, claimToken: claim.claimToken })
    if (!snapshot || !snapshot.candidates.length) {
      await ctx.runMutation(internal.rankingState.fail, { ...args, claimToken: claim.claimToken, retryable: false, summary: 'needs_user: no qualified candidates are available for ranking' })
      return null
    }
    try {
      const ranking = await getRankingPort().rank(snapshot)
      // The adapter has already validated each external string ID against the
      // candidates in this snapshot. Rebrand them for the Convex mutation.
      const validatedRanking = {
        ...ranking,
        rankings: ranking.rankings.map((item) => ({
          ...item,
          candidateId: item.candidateId as Id<'requestCandidates'>,
        })),
      }
      await ctx.runMutation(internal.rankingState.apply, {
        ...args,
        claimToken: claim.claimToken,
        ranking: validatedRanking,
      })
    } catch (error) {
      const failure = classifyExternalError(error)
      await ctx.runMutation(internal.rankingState.fail, { ...args, claimToken: claim.claimToken, retryable: failure.retryable, summary: failure.summary })
    }
    return null
  },
})
