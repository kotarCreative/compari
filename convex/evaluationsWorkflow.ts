'use node'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'

export const generate = internalAction({
  args: {
    requestId: v.id('procurementRequests'),
    jobId: v.id('sideEffectJobs'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(internal.sideEffectJobs.claim, {
      jobId: args.jobId,
      kind: 'evaluate_request',
    })
    if (!claim) return null
    const snapshot = await ctx.runQuery(internal.evaluations.loadSnapshot, {
      ...args,
      claimToken: claim.claimToken,
    })
    if (!snapshot) {
      await ctx.runMutation(internal.sideEffectJobs.retryOrFail, {
        jobId: args.jobId,
        claimToken: claim.claimToken,
        retryable: false,
        summary: 'permanent: evaluation input is stale or unavailable',
      })
      return null
    }
    const views = [
      { type: 'provider_cards', label: 'Provider offers' },
      {
        type: 'comparison_matrix',
        label: 'Compare offers',
        metricKeys: snapshot.metrics.map(
          (metric: { key: string }) => metric.key,
        ),
      },
      {
        type: 'ranking',
        label: 'Evidence confidence',
        metricKeys: ['confidence'],
      },
    ]
    const recommendation = snapshot.candidates[0]
      ? `Current evidence favors ${snapshot.candidates[0].name}${snapshot.preference ? ` using your preference: ${snapshot.preference}` : ''}; ${snapshot.factCount} evidence-backed facts and ${snapshot.proposalCount} website or provider quote snapshots are available. Review each price basis and any missing information before selecting.`
      : 'No comparable provider offers are available yet.'
    await ctx.runMutation(internal.evaluations.apply, {
      ...args,
      claimToken: claim.claimToken,
      recommendation,
      views,
    })
    return null
  },
})
