'use node'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { delimitedUntrustedProviderBody, normalizeExtractionDto } from './domain/reasoning'
import { getReasoningPort } from './adapters/reasoning'

/**
 * The production ReasoningPort is intentionally fail-closed today. This action
 * still performs deterministic, evidence-preserving extraction so a demo and
 * a later gateway adapter share the same apply boundary.
 */
export const extractProviderMessage = internalAction({
  args: { providerMessageId: v.id('providerMessages') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = await ctx.runQuery(internal.reasoningJobs.loadMessage, args)
    if (!input || input.extractionVersion) return null
    let dto = null
    try {
      const output = await getReasoningPort().extractProviderResponse({
        delimitedBody: delimitedUntrustedProviderBody(input.body),
      })
      dto = normalizeExtractionDto(output)
    } catch {
      // A production adapter is deliberately fail-closed. The durable inbound
      // event remains available for a configured adapter or buyer intervention.
      return null
    }
    if (dto) await ctx.runMutation(internal.reasoningJobs.applyExtraction, { providerMessageId: args.providerMessageId, dto })
    return null
  },
})
