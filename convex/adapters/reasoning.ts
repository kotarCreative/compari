'use node'
import type { ExtractedRequirement, ReasoningPort } from '../ports/reasoning'

declare const process: { env: Record<string, string | undefined> }
// Gateway/component packages are intentionally not declared until the deployment
// can install them. This explicit adapter prevents a silent fake model result.
export function getReasoningPort(): ReasoningPort {
  if (process.env.COMPARI_DEMO_MODE === 'true') return createDeterministicReasoningPort()
  return {
    extractRequirements: () =>
      Promise.reject(new Error('needs_user: AI Gateway is not configured')),
    extractProviderResponse: () =>
      Promise.reject(new Error('needs_user: AI Gateway is not configured')),
  }
}

/**
 * A deterministic fixture adapter, used only when the server enables demo mode.
 * It never contacts a model and treats the delimited provider body as evidence.
 */
export function createDeterministicReasoningPort(): ReasoningPort {
  return {
    extractRequirements({ prompt, corrections }) {
      const lowered = prompt.toLowerCase()
      const requirements = corrections.map((item) => ({ ...item }))
      const add = (item: ExtractedRequirement) => {
        if (!requirements.some((existing) => existing.key === item.key)) requirements.push(item)
      }
      const quantity = prompt.match(/\b(\d{1,6})\b/)?.[1]
      if (quantity) add({ key: 'quantity', label: 'Requested quantity', value: quantity, kind: 'hard_constraint', confidence: 0.8 })
      const budget = prompt.match(/(?:under|budget(?: of)?|less than)\s*\$?([\d,]+(?:\.\d{2})?)/i)?.[1]
      if (budget) add({ key: 'budget', label: 'Budget', value: budget.replace(/,/g, ''), kind: 'hard_constraint', confidence: 0.8 })
      if (/matte/.test(lowered)) add({ key: 'finish', label: 'Preferred finish', value: 'matte', kind: 'preference', confidence: 0.9 })
      const nextFriday = /next friday/i.test(prompt)
      if (nextFriday) add({ key: 'deadline', label: 'Requested deadline', value: 'next Friday', kind: 'hard_constraint', confidence: 0.8 })
      return Promise.resolve({
        title: prompt.split(/[.!?\n]/)[0]?.trim().slice(0, 120) || 'Procurement request',
        requirements,
        clarifyingQuestions: requirements.length ? [] : [{ question: 'What quantity, budget, and deadline should providers quote against?', importance: 'required' }],
      })
    },
    extractProviderResponse({ delimitedBody }) {
      const body = delimitedBody.slice(0, 40_000)
      const price = body.match(/(?:\$|CAD\s?)([0-9][0-9,]*(?:\.\d{2})?)/i)?.[1]
      const availability = body.match(/(?:available|delivery|ready|lead time)[^.\n]{0,120}/i)?.[0]
      const question = body.includes('?') ? body.split('?')[0]?.slice(-320).trim() + '?' : undefined
      return Promise.resolve({
        schemaVersion: 1,
        facts: [
          ...(price ? [{ key: 'price', label: 'Quoted price', value: price.replace(/,/g, ''), confidence: 0.8 }] : []),
          ...(availability ? [{ key: 'availability', label: 'Availability', value: availability, confidence: 0.7 }] : []),
        ],
        proposal: {
          status: price && availability ? 'complete' : 'partial',
          summary: 'Evidence was extracted from the delimited provider message.',
          attributes: {},
          missingInformation: price && availability ? [] : ['price or availability'],
        },
        providerQuestion: question && !price ? question : undefined,
        confidence: 0.8,
      })
    },
  }
}
