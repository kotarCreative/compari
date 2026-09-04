'use node'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { getWebResearchPort } from './adapters/firecrawl'
import { getReasoningPort } from './adapters/reasoning'
import { classifyExternalError } from './domain/outboundPolicy'

export const extractRequirements = internalAction({
  args: {
    requestId: v.id('procurementRequests'),
    jobId: v.id('sideEffectJobs'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(internal.sideEffectJobs.claim, {
      jobId: args.jobId,
      kind: 'extract_requirements',
    })
    if (!claim) return null
    const request = await ctx.runQuery(
      internal.workflowState.loadRequestForJob,
      { ...args, claimToken: claim.claimToken },
    )
    if (
      !request ||
      request.automationPaused ||
      request.status === 'cancelled'
    ) {
      await ctx.runMutation(internal.sideEffectJobs.retryOrFail, {
        jobId: args.jobId,
        claimToken: claim.claimToken,
        retryable: false,
        summary:
          'permanent: requirement extraction input is stale or unavailable',
      })
      return null
    }
    try {
      const output = await getReasoningPort().extractRequirements({
        prompt: request.prompt,
        timezone: 'UTC',
        corrections: request.corrections,
        answeredQuestions: request.answeredQuestions,
      })
      await ctx.runMutation(internal.workflowState.completeIntake, {
        ...args,
        claimToken: claim.claimToken,
        output,
      })
    } catch (error) {
      const classified = classifyExternalError(error)
      const failure = await ctx.runMutation(
        internal.sideEffectJobs.retryOrFail,
        {
          jobId: args.jobId,
          claimToken: claim.claimToken,
          retryable: classified.retryable,
          summary: classified.summary,
        },
      )
      if (failure?.retryAt)
        await ctx.runMutation(internal.sideEffectJobs.scheduleRetry, {
          jobId: args.jobId,
          retryAt: failure.retryAt,
        })
    }
    return null
  },
})
export const discoverProviders = internalAction({
  args: {
    requestId: v.id('procurementRequests'),
    jobId: v.id('sideEffectJobs'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(internal.sideEffectJobs.claim, {
      jobId: args.jobId,
      kind: 'discover_providers',
    })
    if (!claim) return null
    const request = await ctx.runQuery(
      internal.workflowState.loadRequestForJob,
      { ...args, claimToken: claim.claimToken },
    )
    if (
      !request ||
      request.automationPaused ||
      request.status !== 'researching'
    ) {
      await ctx.runMutation(internal.sideEffectJobs.retryOrFail, {
        jobId: args.jobId,
        claimToken: claim.claimToken,
        retryable: false,
        summary: 'permanent: provider discovery input is stale or unavailable',
      })
      return null
    }
    try {
      const plan = await getReasoningPort().planProviderSearch({
        prompt: request.prompt,
        location: request.location,
        requirements: request.corrections,
        answeredQuestions: request.answeredQuestions,
      })
      const resultBatches = await Promise.all(
        plan.discoveryQueries.map((query) =>
          getWebResearchPort().searchProviders({
            query,
            limit: 6,
          }),
        ),
      )
      const results = uniqueProviderResults(resultBatches, 10)
      await ctx.runMutation(internal.workflowState.recordDiscovery, {
        ...args,
        claimToken: claim.claimToken,
        results,
        searchQueries: plan.discoveryQueries,
        vendorDetailQuery: plan.vendorDetailQuery,
      })
    } catch (error) {
      const classified = classifyExternalError(error)
      const failure = await ctx.runMutation(
        internal.sideEffectJobs.retryOrFail,
        {
          jobId: args.jobId,
          claimToken: claim.claimToken,
          retryable: classified.retryable,
          summary: classified.summary,
        },
      )
      if (failure?.retryAt)
        await ctx.runMutation(internal.sideEffectJobs.scheduleRetry, {
          jobId: args.jobId,
          retryAt: failure.retryAt,
        })
    }
    return null
  },
})
export const researchCandidate = internalAction({
  args: {
    candidateId: v.id('requestCandidates'),
    jobId: v.id('sideEffectJobs'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(internal.sideEffectJobs.claim, {
      jobId: args.jobId,
      kind: 'research_candidate',
    })
    if (!claim) return null
    const candidate = await ctx.runQuery(
      internal.workflowState.loadCandidateForJob,
      { ...args, claimToken: claim.claimToken },
    )
    if (!candidate) {
      await ctx.runMutation(internal.sideEffectJobs.retryOrFail, {
        jobId: args.jobId,
        claimToken: claim.claimToken,
        retryable: false,
        summary: 'permanent: candidate research input is stale or unavailable',
      })
      return null
    }
    try {
      const pages = await getWebResearchPort().researchProvider({
        url: candidate.website,
        query: candidate.vendorDetailQuery,
        limit: 5,
      })
      await ctx.runMutation(internal.workflowState.recordCandidateResearch, {
        ...args,
        claimToken: claim.claimToken,
        pages,
      })
    } catch (error) {
      const classified = classifyExternalError(error)
      await ctx.runMutation(internal.workflowState.failCandidateResearch, {
        ...args,
        claimToken: claim.claimToken,
        retryable: classified.retryable,
        summary: classified.summary,
      })
    }
    return null
  },
})

function uniqueProviderResults<T extends { url: string }>(
  batches: ReadonlyArray<ReadonlyArray<T>>,
  limit: number,
): Array<T> {
  const results: Array<T> = []
  const domains = new Set<string>()
  const longest = Math.max(0, ...batches.map((batch) => batch.length))
  for (let row = 0; row < longest && results.length < limit; row++) {
    for (const batch of batches) {
      if (row >= batch.length) continue
      const result = batch[row]
      let domain: string
      try {
        domain = new URL(result.url).hostname
          .replace(/^www\./, '')
          .toLowerCase()
      } catch {
        continue
      }
      if (!domain || domains.has(domain)) continue
      domains.add(domain)
      results.push(result)
      if (results.length === limit) break
    }
  }
  return results
}
