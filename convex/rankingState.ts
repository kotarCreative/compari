import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, internalQuery } from './_generated/server'
import { canApplyRanking, normalizeRankingDto } from './domain/ranking'

const rankingItem = v.object({
  candidateId: v.id('requestCandidates'),
  score: v.number(),
  reason: v.string(),
  caveats: v.array(v.string()),
})

export const markRunning = internalMutation({
  args: {
    requestId: v.id('procurementRequests'),
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get('procurementRequests', args.requestId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      request &&
      job?.status === 'running' &&
      job.claimToken === args.claimToken &&
      job.inputVersion === request.version
    )
      await ctx.db.patch('procurementRequests', request._id, {
        rankingStatus: 'running',
        rankingError: undefined,
        updatedAt: Date.now(),
      })
    return null
  },
})

export const load = internalQuery({
  args: {
    requestId: v.id('procurementRequests'),
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      prompt: v.string(),
      requestRequirements: v.array(
        v.object({ key: v.string(), value: v.string() }),
      ),
      candidates: v.array(
        v.object({
          candidateId: v.id('requestCandidates'),
          name: v.string(),
          retainedEvidence: v.array(
            v.object({
              label: v.string(),
              excerpt: v.string(),
              sourceType: v.string(),
              observedAt: v.number(),
              confidence: v.number(),
            }),
          ),
          safePublicContactPaths: v.array(v.string()),
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
      job.kind !== 'rank_candidates' ||
      job.requestId !== request._id ||
      job.status !== 'running' ||
      job.claimToken !== args.claimToken ||
      job.inputVersion !== request.version ||
      request.automationPaused ||
      request.status !== 'researching'
    )
      return null
    const [requirements, candidates] = await Promise.all([
      ctx.db
        .query('requirements')
        .withIndex('by_request_id', (q) => q.eq('requestId', request._id))
        .take(50),
      ctx.db
        .query('requestCandidates')
        .withIndex('by_request_id_and_status', (q) =>
          q.eq('requestId', request._id).eq('status', 'qualified'),
        )
        .take(10),
    ])
    const hydrated = [] as Array<{
      candidateId: (typeof candidates)[number]['_id']
      name: string
      retainedEvidence: Array<{
        label: string
        excerpt: string
        sourceType: string
        observedAt: number
        confidence: number
      }>
      safePublicContactPaths: Array<string>
    }>
    for (const candidate of candidates) {
      const business = await ctx.db.get('businesses', candidate.businessId)
      if (!business) continue
      const [facts, endpoints] = await Promise.all([
        ctx.db
          .query('facts')
          .withIndex('by_candidate_id', (q) =>
            q.eq('candidateId', candidate._id),
          )
          .take(8),
        ctx.db
          .query('contactEndpoints')
          .withIndex('by_business_id_and_type', (q) =>
            q.eq('businessId', business._id),
          )
          .take(4),
      ])
      hydrated.push({
        candidateId: candidate._id,
        name: business.canonicalName.slice(0, 160),
        retainedEvidence: facts.map((f) => ({
          label: f.label.slice(0, 120),
          excerpt: (f.sourceReference.excerpt ?? '').slice(0, 700),
          sourceType: f.sourceType,
          observedAt: f.observedAt,
          confidence: f.confidence,
        })),
        safePublicContactPaths: endpoints
          .filter(
            (e) =>
              e.type === 'email' &&
              (e.verificationState === 'public' ||
                e.verificationState === 'verified'),
          )
          .map((e) => e.type)
          .slice(0, 1),
      })
    }
    // A recommendation is an invitation to contact a provider. Do not ask the
    // ranker to recommend a candidate unless retained public evidence includes
    // a supported, verified email path; the apply boundary marks the rest not
    // recommended. Contact-form automation is not enabled in this release.
    return {
      prompt: request.prompt.slice(0, 4_000),
      requestRequirements: requirements.map((r) => ({
        key: r.key,
        value: JSON.stringify(r.value.value).slice(0, 500),
      })),
      candidates: hydrated.filter(
        (candidate) => candidate.safePublicContactPaths.length > 0,
      ),
    }
  },
})

export const apply = internalMutation({
  args: {
    requestId: v.id('procurementRequests'),
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
    ranking: v.object({
      schemaVersion: v.literal(1),
      rankings: v.array(rankingItem),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get('procurementRequests', args.requestId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      !request ||
      !job ||
      !canApplyRanking({
        jobKind: job.kind,
        requestIdMatches: job.requestId === request._id,
        status: job.status,
        claimMatches: job.claimToken === args.claimToken,
        jobInputVersion: job.inputVersion,
        requestVersion: request.version,
      })
    )
      return null
    const qualified = await ctx.db
      .query('requestCandidates')
      .withIndex('by_request_id_and_status', (q) =>
        q.eq('requestId', request._id).eq('status', 'qualified'),
      )
      .take(10)
    const allowed = new Set(qualified.map((c) => String(c._id)))
    const ranking = normalizeRankingDto(args.ranking, allowed)
    if (!ranking) return null
    const byId = new Map(ranking.rankings.map((x) => [x.candidateId, x]))
    const now = Date.now()
    for (const candidate of qualified) {
      const item = byId.get(String(candidate._id))
      await ctx.db.patch(
        'requestCandidates',
        candidate._id,
        item
          ? {
              recommendationStatus: 'recommended',
              recommendationScore: item.score,
              recommendationReason: item.reason,
              recommendationCaveats: item.caveats,
              recommendationVersion: request.version,
              shortlistRank:
                ranking.rankings.findIndex(
                  (x) => x.candidateId === item.candidateId,
                ) + 1,
              updatedAt: now,
            }
          : {
              recommendationStatus: 'not_recommended',
              recommendationScore: undefined,
              recommendationReason:
                'Not selected from the bounded evidence currently available.',
              recommendationCaveats: [
                'More request-relevant evidence or a safe contact path is needed.',
              ],
              recommendationVersion: request.version,
              updatedAt: now,
            },
      )
    }
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: 'succeeded',
      completedAt: now,
      claimToken: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    })
    await ctx.db.patch('procurementRequests', request._id, {
      rankingStatus: 'ready',
      rankingError: undefined,
      rankingVersion: request.version,
      updatedAt: now,
    })
    await ctx.db.insert('activityEvents', {
      requestId: request._id,
      eventType: 'candidates_ranked',
      safeMessage: `${ranking.rankings.length} evidence-bounded candidates were recommended for buyer review.`,
      correlationId: String(job._id),
      createdAt: now,
    })
    return null
  },
})

export const fail = internalMutation({
  args: {
    requestId: v.id('procurementRequests'),
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
    retryable: v.boolean(),
    summary: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get('procurementRequests', args.requestId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      !request ||
      !job ||
      !canApplyRanking({
        jobKind: job.kind,
        requestIdMatches: job.requestId === request._id,
        status: job.status,
        claimMatches: job.claimToken === args.claimToken,
        jobInputVersion: job.inputVersion,
        requestVersion: request.version,
      })
    )
      return null
    const now = Date.now()
    const retry = await ctx.runMutation(internal.sideEffectJobs.retryOrFail, {
      jobId: job._id,
      claimToken: args.claimToken,
      retryable: args.retryable,
      summary: args.summary.slice(0, 300),
    })
    const status = retry ? 'retryable_failure' : 'needs_user'
    await ctx.db.patch('procurementRequests', request._id, {
      rankingStatus: status,
      rankingError: args.summary.slice(0, 300),
      updatedAt: now,
    })
    if (retry)
      await ctx.runMutation(internal.sideEffectJobs.scheduleRetry, {
        jobId: job._id,
        retryAt: retry.retryAt,
      })
    return null
  },
})
