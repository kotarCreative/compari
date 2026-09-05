import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, internalQuery } from './_generated/server'
import {
  buyerLocationQuestion,
  normalizeDomain,
  questionsAreSimilar,
  transitionCandidate,
  transitionRequest,
  validateBoundedJson,
} from './domain/workflowState'
import { extractPublicEndpoints } from './domain/researchEndpoints'
import { rankingSettlement } from './domain/ranking'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'

/** Queue exactly one request-version ranking after the initially discovered
 * candidate jobs have reached a terminal state. Each active-state lookup uses
 * the composite index, so no broad job scan decides buyer-facing work. */
async function queueRankingWhenInitialResearchSettles(
  ctx: MutationCtx,
  request: {
    _id: Id<'procurementRequests'>
    userId: Id<'users'>
    version: number
    status: string
    automationPaused: boolean
  },
  now: number,
): Promise<Id<'sideEffectJobs'> | null> {
  if (request.automationPaused || request.status !== 'researching') return null
  const active = await Promise.all(
    ['pending', 'running', 'retryable_failure'].map((status) =>
      ctx.db
        .query('sideEffectJobs')
        .withIndex('by_request_id_and_kind_and_status_and_input_version', (q) =>
          q
            .eq('requestId', request._id)
            .eq('kind', 'research_candidate')
            .eq('status', status as 'pending' | 'running' | 'retryable_failure')
            .eq('inputVersion', request.version),
        )
        .take(1),
    ),
  )
  const qualified = await ctx.db
    .query('requestCandidates')
    .withIndex('by_request_id_and_status', (q) =>
      q.eq('requestId', request._id).eq('status', 'qualified'),
    )
    .take(1)
  const settlement = rankingSettlement({
    activeResearchJobs: active.reduce((total, jobs) => total + jobs.length, 0),
    qualifiedCandidates: qualified.length,
  })
  if (settlement === 'wait') return null
  if (settlement === 'empty') {
    await ctx.db.patch('procurementRequests', request._id, {
      rankingStatus: 'ready',
      rankingError: undefined,
      rankingVersion: request.version,
      updatedAt: now,
    })
    return null
  }
  const idempotencyKey = `rank:${request._id}:v${request.version}:initial-settled`
  const existing = await ctx.db
    .query('sideEffectJobs')
    .withIndex('by_idempotency_key', (q) =>
      q.eq('idempotencyKey', idempotencyKey),
    )
    .unique()
  if (existing) return null
  const jobId = await ctx.db.insert('sideEffectJobs', {
    userId: request.userId,
    kind: 'rank_candidates',
    idempotencyKey,
    status: 'pending',
    attemptCount: 0,
    maxAttempts: 3,
    requestId: request._id,
    inputVersion: request.version,
    scheduledAt: now,
    createdAt: now,
    updatedAt: now,
  })
  await ctx.db.patch('procurementRequests', request._id, {
    rankingStatus: 'pending',
    rankingError: undefined,
    updatedAt: now,
  })
  return jobId
}

export const loadRequestForJob = internalQuery({
  args: {
    requestId: v.id('procurementRequests'),
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      prompt: v.string(),
      location: v.optional(v.string()),
      version: v.number(),
      status: v.union(
        v.literal('draft'),
        v.literal('researching'),
        v.literal('contacting'),
        v.literal('collecting_responses'),
        v.literal('evaluating'),
        v.literal('awaiting_selection'),
        v.literal('completed'),
        v.literal('cancelled'),
      ),
      automationPaused: v.boolean(),
      corrections: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          value: v.any(),
          kind: v.union(
            v.literal('hard_constraint'),
            v.literal('preference'),
            v.literal('information'),
          ),
          importance: v.optional(v.number()),
          confidence: v.number(),
        }),
      ),
      answeredQuestions: v.array(
        v.object({
          question: v.string(),
          answer: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const request = await ctx.db.get('procurementRequests', args.requestId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      !request ||
      !job ||
      job.requestId !== request._id ||
      job.inputVersion !== request.version ||
      job.status !== 'running' ||
      job.claimToken !== args.claimToken
    )
      return null
    const [corrections, answeredQuestions] = await Promise.all([
      ctx.db
        .query('requirements')
        .withIndex('by_request_id', (q) => q.eq('requestId', request._id))
        .take(100),
      ctx.db
        .query('questions')
        .withIndex('by_request_id_and_status', (q) =>
          q.eq('requestId', request._id).eq('status', 'answered'),
        )
        .take(100),
    ])
    return {
      prompt: request.prompt,
      location: request.location,
      version: request.version,
      status: request.status,
      automationPaused: request.automationPaused,
      corrections: corrections
        .filter((item) => item.source === 'user')
        .map((item) => ({
          key: item.key,
          label: item.label,
          value: item.value.value,
          kind: item.kind,
          importance: item.importance,
          confidence: item.confidence,
        })),
      answeredQuestions: answeredQuestions.flatMap((question) =>
        question.answer === undefined
          ? []
          : [{ question: question.text, answer: question.answer }],
      ),
    }
  },
})
export const completeIntake = internalMutation({
  args: {
    requestId: v.id('procurementRequests'),
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
    output: v.object({
      title: v.string(),
      location: v.optional(v.string()),
      requirements: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          value: v.any(),
          kind: v.union(
            v.literal('hard_constraint'),
            v.literal('preference'),
            v.literal('information'),
          ),
          importance: v.optional(v.number()),
          confidence: v.number(),
        }),
      ),
      clarifyingQuestions: v.array(
        v.object({
          question: v.string(),
          importance: v.union(v.literal('required'), v.literal('useful')),
        }),
      ),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get('procurementRequests', args.requestId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      !request ||
      !job ||
      job.requestId !== request._id ||
      job.inputVersion !== request.version ||
      job.status !== 'running' ||
      job.claimToken !== args.claimToken
    )
      return null
    const now = Date.now()
    const outputRequirements = args.output.requirements.slice(0, 20)
    const existingRequirements = await ctx.db
      .query('requirements')
      .withIndex('by_request_id', (q) => q.eq('requestId', request._id))
      .take(100)
    const userKeys = new Set(
      existingRequirements
        .filter((item) => item.source === 'user')
        .map((item) => item.key),
    )
    for (const item of outputRequirements) {
      if (!/^[a-z0-9_]{1,64}$/.test(item.key) || userKeys.has(item.key))
        continue
      try {
        validateBoundedJson(item.value)
      } catch {
        continue
      }
      const existing = existingRequirements.find((row) => row.key === item.key)
      const patch = {
        label: item.label.slice(0, 160),
        value: { schemaVersion: 1 as const, value: item.value },
        kind: item.kind,
        importance: item.importance,
        source: 'inference' as const,
        confidence: Math.max(0, Math.min(1, item.confidence)),
        updatedAt: now,
      }
      if (existing) await ctx.db.patch('requirements', existing._id, patch)
      else
        await ctx.db.insert('requirements', {
          requestId: request._id,
          key: item.key,
          ...patch,
          createdAt: now,
        })
    }
    const existingQuestions = await ctx.db
      .query('questions')
      .withIndex('by_request_id', (q) => q.eq('requestId', request._id))
      .take(100)
    const answeredQuestionTexts = existingQuestions.flatMap((question) =>
      question.status === 'answered' ? [question.text] : [],
    )
    for (const question of existingQuestions) {
      if (
        question.status === 'open' &&
        answeredQuestionTexts.some((answered) =>
          questionsAreSimilar(answered, question.text),
        )
      )
        await ctx.db.patch('questions', question._id, {
          status: 'resolved',
          updatedAt: now,
        })
    }
    const knownQuestionTexts = existingQuestions.map(
      (question) => question.text,
    )
    for (const question of args.output.clarifyingQuestions.slice(0, 10)) {
      const text = question.question.trim().slice(0, 500)
      if (
        text &&
        !knownQuestionTexts.some((existing) =>
          questionsAreSimilar(existing, text),
        )
      ) {
        await ctx.db.insert('questions', {
          requestId: request._id,
          text,
          importance: question.importance,
          status: 'open',
          supportingFactIds: [],
          createdAt: now,
          updatedAt: now,
        })
        knownQuestionTexts.push(text)
      }
    }
    if (request.status === 'draft') transitionRequest('draft', 'researching')
    await ctx.db.patch('procurementRequests', request._id, {
      title: args.output.title.trim().slice(0, 120) || 'Procurement request',
      location: args.output.location?.trim().slice(0, 160) || request.location,
      status: request.status === 'draft' ? 'researching' : request.status,
      interpretedVersion: request.version,
      researchStatus:
        request.status === 'draft' || request.status === 'researching'
          ? 'in_progress'
          : request.researchStatus,
      updatedAt: now,
    })
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: 'succeeded',
      completedAt: now,
      claimToken: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    })
    const waitingForLocation = existingQuestions.some(
      (question) =>
        question.status === 'open' &&
        questionsAreSimilar(question.text, buyerLocationQuestion),
    )
    if (waitingForLocation) return null
    if (request.status !== 'draft' && request.status !== 'researching')
      return null
    const discoveryJobId = await ctx.db.insert('sideEffectJobs', {
      userId: request.userId,
      kind: 'discover_providers',
      idempotencyKey: `discover:${request._id}:v${request.version}`,
      status: 'pending',
      attemptCount: 0,
      maxAttempts: 3,
      requestId: request._id,
      inputVersion: request.version,
      scheduledAt: now,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('activityEvents', {
      requestId: request._id,
      eventType: 'requirements_interpreted',
      safeMessage: 'Requirements interpreted; researching providers.',
      correlationId: String(discoveryJobId),
      createdAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.workflows.discoverProviders, {
      requestId: request._id,
      jobId: discoveryJobId,
    })
    return null
  },
})

export const recordDiscovery = internalMutation({
  args: {
    requestId: v.id('procurementRequests'),
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
    results: v.array(
      v.object({
        name: v.string(),
        url: v.string(),
        snippet: v.optional(v.string()),
      }),
    ),
    searchQueries: v.array(v.string()),
    vendorDetailQuery: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get('procurementRequests', args.requestId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      !request ||
      !job ||
      job.requestId !== request._id ||
      job.inputVersion !== request.version ||
      job.status !== 'running' ||
      job.claimToken !== args.claimToken
    )
      return null
    const now = Date.now()
    let discovered = 0
    let usableProviders = 0
    const scheduled: Array<{
      candidateId: Id<'requestCandidates'>
      jobId: Id<'sideEffectJobs'>
    }> = []
    for (const result of args.results.slice(0, 10)) {
      let domain: string
      try {
        domain = normalizeDomain(result.url)
      } catch {
        continue
      }
      let business = await ctx.db
        .query('businesses')
        .withIndex('by_domain', (q) => q.eq('normalizedDomain', domain))
        .first()
      if (!business) {
        const id = await ctx.db.insert('businesses', {
          canonicalName: result.name,
          normalizedDomain: domain,
          website: result.url,
          createdAt: now,
          updatedAt: now,
        })
        business = await ctx.db.get('businesses', id)
      }
      if (!business) continue
      const candidate = await ctx.db
        .query('requestCandidates')
        .withIndex('by_request_id_and_business_id', (q) =>
          q.eq('requestId', request._id).eq('businessId', business._id),
        )
        .unique()
      usableProviders++
      if (!candidate) {
        const candidateId = await ctx.db.insert('requestCandidates', {
          requestId: request._id,
          businessId: business._id,
          status: 'discovered',
          version: 1,
          inputVersion: request.version,
          createdAt: now,
          updatedAt: now,
        })
        const researchJobId = await ctx.db.insert('sideEffectJobs', {
          userId: request.userId,
          kind: 'research_candidate',
          idempotencyKey: `research:${candidateId}:v1`,
          status: 'pending',
          attemptCount: 0,
          maxAttempts: 3,
          requestId: request._id,
          candidateId,
          inputVersion: request.version,
          scheduledAt: now,
          createdAt: now,
          updatedAt: now,
        })
        scheduled.push({ candidateId, jobId: researchJobId })
        discovered++
      }
    }
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: 'succeeded',
      completedAt: now,
      claimToken: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    })
    await ctx.db.patch('procurementRequests', request._id, {
      researchStatus: usableProviders ? 'complete' : 'empty',
      searchQueries: args.searchQueries.slice(0, 4),
      vendorDetailQuery: args.vendorDetailQuery.slice(0, 240),
      searchPlanVersion: request.version,
      candidateCounts: {
        ...request.candidateCounts,
        discovered: request.candidateCounts.discovered + discovered,
      },
      updatedAt: now,
    })
    for (const next of scheduled)
      await ctx.scheduler.runAfter(
        0,
        internal.workflows.researchCandidate,
        next,
      )
    const rankingJobId = await queueRankingWhenInitialResearchSettles(
      ctx,
      request,
      now,
    )
    await ctx.db.insert('activityEvents', {
      requestId: request._id,
      eventType: usableProviders ? 'providers_discovered' : 'research_empty',
      safeMessage: usableProviders
        ? `${usableProviders} providers matched this request; ${discovered} were newly discovered.`
        : 'No providers were discovered. Update the request and retry research.',
      correlationId: String(job._id),
      createdAt: now,
    })
    if (rankingJobId)
      await ctx.scheduler.runAfter(0, internal.rankingWorkflow.rank, {
        requestId: request._id,
        jobId: rankingJobId,
      })
    return null
  },
})
export const loadCandidateForJob = internalQuery({
  args: {
    candidateId: v.id('requestCandidates'),
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({ website: v.string(), vendorDetailQuery: v.string() }),
  ),
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get('requestCandidates', args.candidateId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      !candidate ||
      !job ||
      job.candidateId !== candidate._id ||
      job.status !== 'running' ||
      job.claimToken !== args.claimToken
    )
      return null
    const request = await ctx.db.get('procurementRequests', candidate.requestId)
    const business = await ctx.db.get('businesses', candidate.businessId)
    if (
      !request ||
      !business ||
      request.automationPaused ||
      request.status !== 'researching' ||
      request.version !== candidate.inputVersion
    )
      return null
    return {
      website: business.website,
      vendorDetailQuery:
        request.searchPlanVersion === request.version &&
        request.vendorDetailQuery
          ? request.vendorDetailQuery
          : request.prompt.slice(0, 240),
    }
  },
})
export const recordCandidateResearch = internalMutation({
  args: {
    candidateId: v.id('requestCandidates'),
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
    pages: v.array(
      v.object({
        url: v.string(),
        title: v.optional(v.string()),
        markdown: v.string(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get('requestCandidates', args.candidateId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      !candidate ||
      !job ||
      job.candidateId !== candidate._id ||
      job.status !== 'running' ||
      job.claimToken !== args.claimToken
    )
      return null
    const request = await ctx.db.get('procurementRequests', candidate.requestId)
    const business = await ctx.db.get('businesses', candidate.businessId)
    if (
      !request ||
      !business ||
      request.version !== candidate.inputVersion ||
      candidate.status !== 'discovered'
    )
      return null
    const now = Date.now()
    transitionCandidate(candidate.status, 'researching')
    transitionCandidate(
      'researching',
      args.pages.length ? 'qualified' : 'rejected',
    )
    const markdown = args.pages
      .map((page) => page.markdown)
      .join('\n')
      .slice(0, 40_000)
    await ctx.db.patch('requestCandidates', candidate._id, {
      status: args.pages.length ? 'qualified' : 'rejected',
      qualificationSummary: args.pages.length
        ? 'Website researched; awaiting provider response for final comparison.'
        : undefined,
      rejectionSummary: args.pages.length
        ? undefined
        : 'No usable public website content was available.',
      recommendationStatus: args.pages.length ? 'unranked' : undefined,
      version: candidate.version + 1,
      updatedAt: now,
    })
    if (args.pages.length)
      await ctx.db.insert('facts', {
        requestId: request._id,
        candidateId: candidate._id,
        businessId: business._id,
        key: 'website_research',
        label: 'Website research',
        value: {
          schemaVersion: 1,
          value: { title: args.pages[0]?.title ?? business.canonicalName },
        },
        sourceType: 'website',
        sourceReference: {
          url: args.pages[0]?.url ?? business.website,
          excerpt: markdown.slice(0, 1_500),
        },
        confidence: 0.7,
        observedAt: now,
        createdAt: now,
      })
    const endpoints = extractPublicEndpoints(args.pages)
    for (const extracted of endpoints) {
      const endpoint = await ctx.db
        .query('contactEndpoints')
        .withIndex('by_business_id_and_value', (q) =>
          q.eq('businessId', business._id).eq('value', extracted.value),
        )
        .first()
      if (!endpoint)
        await ctx.db.insert('contactEndpoints', {
          businessId: business._id,
          type: extracted.type === 'form' ? 'contact_form' : 'email',
          value: extracted.value,
          verificationState: 'public',
          metadata: { schemaVersion: 1, value: {} },
          discoveryEvidence: {
            url: extracted.sourceUrl,
            observedAt: now,
            confidence: 0.7,
          },
          createdAt: now,
          updatedAt: now,
        })
    }
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: 'succeeded',
      completedAt: now,
      claimToken: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    })
    await ctx.db.patch('procurementRequests', request._id, {
      status: request.status,
      candidateCounts: {
        ...request.candidateCounts,
        discovered: Math.max(0, request.candidateCounts.discovered - 1),
        qualified:
          request.candidateCounts.qualified + (args.pages.length ? 1 : 0),
        rejected:
          request.candidateCounts.rejected + (args.pages.length ? 0 : 1),
        queuedForContact: request.candidateCounts.queuedForContact,
      },
      updatedAt: now,
    })
    const rankingJobId = await queueRankingWhenInitialResearchSettles(
      ctx,
      request,
      now,
    )
    await ctx.db.insert('activityEvents', {
      requestId: request._id,
      candidateId: candidate._id,
      eventType: args.pages.length
        ? 'candidate_qualified'
        : 'candidate_rejected',
      safeMessage: args.pages.length
        ? `${business.canonicalName} was researched with evidence and awaits buyer shortlist selection.`
        : `${business.canonicalName} could not be researched.`,
      correlationId: String(job._id),
      createdAt: now,
    })
    if (rankingJobId)
      await ctx.scheduler.runAfter(0, internal.rankingWorkflow.rank, {
        requestId: request._id,
        jobId: rankingJobId,
      })
    return null
  },
})
export const failCandidateResearch = internalMutation({
  args: {
    candidateId: v.id('requestCandidates'),
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
    retryable: v.boolean(),
    summary: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const candidate = await ctx.db.get('requestCandidates', args.candidateId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      !candidate ||
      !job ||
      job.candidateId !== candidate._id ||
      job.status !== 'running' ||
      job.claimToken !== args.claimToken
    )
      return null
    const request = await ctx.db.get('procurementRequests', candidate.requestId)
    if (!request || request.version !== candidate.inputVersion) return null
    const now = Date.now()
    const retry = await ctx.runMutation(internal.sideEffectJobs.retryOrFail, {
      jobId: job._id,
      claimToken: args.claimToken,
      retryable: args.retryable,
      summary: args.summary.slice(0, 300),
    })
    if (retry) {
      await ctx.runMutation(internal.sideEffectJobs.scheduleRetry, {
        jobId: job._id,
        retryAt: retry.retryAt,
      })
      return null
    }
    if (candidate.status === 'discovered') {
      transitionCandidate('discovered', 'researching')
      transitionCandidate('researching', 'rejected')
      await ctx.db.patch('requestCandidates', candidate._id, {
        status: 'rejected',
        rejectionSummary:
          'Research could not obtain usable public website evidence.',
        version: candidate.version + 1,
        updatedAt: now,
      })
      await ctx.db.patch('procurementRequests', request._id, {
        candidateCounts: {
          ...request.candidateCounts,
          discovered: Math.max(0, request.candidateCounts.discovered - 1),
          rejected: request.candidateCounts.rejected + 1,
        },
        updatedAt: now,
      })
    }
    const rankingJobId = await queueRankingWhenInitialResearchSettles(
      ctx,
      request,
      now,
    )
    await ctx.db.insert('activityEvents', {
      requestId: request._id,
      candidateId: candidate._id,
      eventType: 'candidate_rejected',
      safeMessage: 'A provider could not be researched from public evidence.',
      correlationId: String(job._id),
      createdAt: now,
    })
    if (rankingJobId)
      await ctx.scheduler.runAfter(0, internal.rankingWorkflow.rank, {
        requestId: request._id,
        jobId: rankingJobId,
      })
    return null
  },
})
export const failResearchJob = internalMutation({
  args: {
    requestId: v.id('procurementRequests'),
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
    summary: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get('procurementRequests', args.requestId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      !request ||
      !job ||
      job.requestId !== request._id ||
      job.status !== 'running' ||
      job.claimToken !== args.claimToken
    )
      return null
    const now = Date.now()
    const retryable =
      args.summary.startsWith('retryable_external:') &&
      job.attemptCount < (job.maxAttempts ?? 3)
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: retryable ? 'retryable_failure' : 'needs_user',
      lastErrorCategory: retryable ? 'retryable_external' : 'needs_user',
      lastErrorSummary: args.summary,
      updatedAt: now,
    })
    await ctx.db.patch('procurementRequests', request._id, {
      researchStatus: 'empty',
      updatedAt: now,
    })
    await ctx.db.insert('activityEvents', {
      requestId: request._id,
      eventType: 'research_blocked',
      safeMessage: args.summary.replace(/^[^:]+:\s*/, ''),
      correlationId: String(job._id),
      createdAt: now,
    })
    return null
  },
})
