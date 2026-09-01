'use node'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import {
  delimitedUntrustedProviderBody,
  normalizeExtractionDto,
} from './domain/reasoning'
import { getReasoningPort } from './adapters/reasoning'
import { classifyExternalError } from './domain/outboundPolicy'

export const extractProviderMessage = internalAction({
  args: {
    providerMessageId: v.id('providerMessages'),
    jobId: v.id('sideEffectJobs'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(internal.sideEffectJobs.claim, {
      jobId: args.jobId,
      kind: 'extract_provider_response',
    })
    if (!claim) return null
    const input = await ctx.runQuery(internal.reasoningJobs.loadMessage, {
      ...args,
      claimToken: claim.claimToken,
    })
    if (!input) {
      await ctx.runMutation(internal.sideEffectJobs.retryOrFail, {
        jobId: args.jobId,
        claimToken: claim.claimToken,
        retryable: false,
        summary: 'Provider response extraction input is no longer available.',
      })
      return null
    }
    if (input.extractionVersion) {
      await ctx.runMutation(internal.sideEffectJobs.complete, {
        jobId: args.jobId,
        claimToken: claim.claimToken,
      })
      return null
    }
    try {
      const output = await getReasoningPort().extractProviderResponse({
        delimitedBody: delimitedUntrustedProviderBody(input.body),
      })
      const dto = normalizeExtractionDto(output)
      if (!dto)
        throw new Error(
          'permanent_external: AI response extraction returned invalid structured output',
        )
      await ctx.runMutation(internal.reasoningJobs.applyExtraction, {
        ...args,
        claimToken: claim.claimToken,
        dto,
      })
    } catch (error) {
      const failure = classifyExternalError(error)
      const retry = await ctx.runMutation(internal.sideEffectJobs.retryOrFail, {
        jobId: args.jobId,
        claimToken: claim.claimToken,
        retryable: failure.retryable,
        summary: failure.summary,
      })
      if (retry?.retryAt)
        await ctx.runMutation(internal.sideEffectJobs.scheduleRetry, {
          jobId: args.jobId,
          retryAt: retry.retryAt,
        })
    }
    return null
  },
})
