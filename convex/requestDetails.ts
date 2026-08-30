import { v } from 'convex/values'
import { query } from './_generated/server'
import { requireOwnedRequest } from './lib/auth'
import type { Id } from './_generated/dataModel'

const json = v.object({ schemaVersion: v.literal(1), value: v.any() })

export const get = query({
  args: { requestId: v.id('procurementRequests') },
  returns: v.object({
    request: v.object({
      _id: v.id('procurementRequests'),
      prompt: v.string(),
      title: v.string(),
      location: v.optional(v.string()),
      status: v.string(),
      automationPaused: v.boolean(),
      version: v.number(),
      researchStatus: v.string(),
      rankingStatus: v.optional(v.string()),
      rankingError: v.optional(v.string()),
      rankingVersion: v.optional(v.number()),
      candidateCounts: v.object({
        discovered: v.number(),
        researching: v.number(),
        qualified: v.number(),
        rejected: v.number(),
        queuedForContact: v.number(),
        contacted: v.number(),
        responded: v.number(),
      }),
    }),
    requirements: v.array(
      v.object({
        _id: v.id('requirements'),
        key: v.string(),
        label: v.string(),
        value: json,
        kind: v.string(),
        source: v.string(),
        importance: v.optional(v.number()),
        confidence: v.number(),
      }),
    ),
    questions: v.array(
      v.object({
        _id: v.id('questions'),
        candidateId: v.optional(v.id('requestCandidates')),
        text: v.string(),
        importance: v.string(),
        status: v.string(),
        answer: v.optional(v.string()),
      }),
    ),
    candidates: v.array(
      v.object({
        _id: v.id('requestCandidates'),
        businessId: v.id('businesses'),
        name: v.string(),
        website: v.string(),
        status: v.string(),
        qualificationSummary: v.optional(v.string()),
        rejectionSummary: v.optional(v.string()),
        shortlistReason: v.optional(v.string()),
        recommendationStatus: v.optional(v.string()),
        recommendationScore: v.optional(v.number()),
        recommendationReason: v.optional(v.string()),
        recommendationCaveats: v.optional(v.array(v.string())),
        endpoints: v.array(
          v.object({
            _id: v.id('contactEndpoints'),
            type: v.string(),
            value: v.string(),
            verificationState: v.string(),
            evidenceUrl: v.string(),
          }),
        ),
        facts: v.array(
          v.object({
            _id: v.id('facts'),
            key: v.string(),
            label: v.string(),
            value: json,
            sourceType: v.string(),
            sourceUrl: v.optional(v.string()),
            excerpt: v.optional(v.string()),
            confidence: v.number(),
            observedAt: v.number(),
          }),
        ),
      }),
    ),
    outreach: v.array(
      v.object({
        _id: v.id('outreachAttempts'),
        candidateId: v.id('requestCandidates'),
        method: v.string(),
        status: v.string(),
        contentSummary: v.string(),
        safeError: v.optional(v.string()),
        updatedAt: v.number(),
      }),
    ),
    conversations: v.array(
      v.object({
        _id: v.id('conversations'),
        candidateId: v.id('requestCandidates'),
        status: v.string(),
        lastMessageAt: v.optional(v.number()),
        messages: v.array(
          v.object({
            _id: v.id('providerMessages'),
            direction: v.string(),
            participants: v.array(v.string()),
            subject: v.string(),
            sanitizedBody: v.string(),
            occurredAt: v.number(),
            agentMailMessageId: v.string(),
          }),
        ),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const { request } = await requireOwnedRequest(ctx, args.requestId)
    const [requirements, questions, candidates, attempts, conversations] =
      await Promise.all([
        ctx.db
          .query('requirements')
          .withIndex('by_request_id', (q) => q.eq('requestId', request._id))
          .take(100),
        ctx.db
          .query('questions')
          .withIndex('by_request_id', (q) => q.eq('requestId', request._id))
          .take(100),
        ctx.db
          .query('requestCandidates')
          .withIndex('by_request_id', (q) => q.eq('requestId', request._id))
          .take(20),
        ctx.db
          .query('outreachAttempts')
          .withIndex('by_request_id', (q) => q.eq('requestId', request._id))
          .order('desc')
          .take(30),
        ctx.db
          .query('conversations')
          .withIndex('by_request_id_and_candidate_id', (q) =>
            q.eq('requestId', request._id),
          )
          .take(20),
      ])
    const candidateDetails: Array<{
      _id: Id<'requestCandidates'>
      businessId: Id<'businesses'>
      name: string
      website: string
      status: string
      qualificationSummary?: string
      rejectionSummary?: string
      shortlistReason?: string
      recommendationStatus?: string
      recommendationScore?: number
      recommendationReason?: string
      recommendationCaveats?: Array<string>
      endpoints: Array<{
        _id: Id<'contactEndpoints'>
        type: string
        value: string
        verificationState: string
        evidenceUrl: string
      }>
      facts: Array<{
        _id: Id<'facts'>
        key: string
        label: string
        value: { schemaVersion: 1; value: unknown }
        sourceType: string
        sourceUrl?: string
        excerpt?: string
        confidence: number
        observedAt: number
      }>
    }> = []
    for (const candidate of candidates) {
      const business = await ctx.db.get('businesses', candidate.businessId)
      if (!business) continue
      const [endpoints, facts] = await Promise.all([
        ctx.db
          .query('contactEndpoints')
          .withIndex('by_business_id_and_type', (q) =>
            q.eq('businessId', business._id),
          )
          .take(10),
        ctx.db
          .query('facts')
          .withIndex('by_candidate_id', (q) =>
            q.eq('candidateId', candidate._id),
          )
          .take(20),
      ])
      candidateDetails.push({
        _id: candidate._id,
        businessId: candidate.businessId,
        name: business.canonicalName,
        website: business.website,
        status: candidate.status,
        qualificationSummary: candidate.qualificationSummary,
        rejectionSummary: candidate.rejectionSummary,
        shortlistReason: candidate.shortlistReason,
        recommendationStatus: candidate.recommendationStatus,
        recommendationScore: candidate.recommendationScore,
        recommendationReason: candidate.recommendationReason,
        recommendationCaveats: candidate.recommendationCaveats,
        endpoints: endpoints.map((endpoint) => ({
          _id: endpoint._id,
          type: endpoint.type,
          value: endpoint.value,
          verificationState: endpoint.verificationState,
          evidenceUrl: endpoint.discoveryEvidence.url,
        })),
        facts: facts.map((fact) => ({
          _id: fact._id,
          key: fact.key,
          label: fact.label,
          value: fact.value,
          sourceType: fact.sourceType,
          sourceUrl: fact.sourceReference.url,
          excerpt: fact.sourceReference.excerpt,
          confidence: fact.confidence,
          observedAt: fact.observedAt,
        })),
      })
    }
    const conversationDetails: Array<{
      _id: Id<'conversations'>
      candidateId: Id<'requestCandidates'>
      status: string
      lastMessageAt?: number
      messages: Array<{
        _id: Id<'providerMessages'>
        direction: string
        participants: Array<string>
        subject: string
        sanitizedBody: string
        occurredAt: number
        agentMailMessageId: string
      }>
    }> = []
    for (const conversation of conversations) {
      const messages = await ctx.db
        .query('providerMessages')
        .withIndex('by_conversation_id_and_created_at', (q) =>
          q.eq('conversationId', conversation._id),
        )
        .order('desc')
        .take(10)
      conversationDetails.push({
        _id: conversation._id,
        candidateId: conversation.candidateId,
        status: conversation.status,
        lastMessageAt: conversation.lastMessageAt,
        messages: messages.reverse().map((message) => ({
          _id: message._id,
          direction: message.direction,
          participants: message.participants,
          subject: message.subject,
          sanitizedBody: message.sanitizedBody,
          occurredAt: message.occurredAt,
          agentMailMessageId: message.agentMailMessageId,
        })),
      })
    }
    return {
      request: {
        _id: request._id,
        prompt: request.prompt,
        title: request.title,
        location: request.location,
        status: request.status,
        automationPaused: request.automationPaused,
        version: request.version,
        researchStatus: request.researchStatus,
        rankingStatus: request.rankingStatus,
        rankingError: request.rankingError,
        rankingVersion: request.rankingVersion,
        candidateCounts: request.candidateCounts,
      },
      requirements: requirements.map((item) => ({
        _id: item._id,
        key: item.key,
        label: item.label,
        value: item.value,
        kind: item.kind,
        source: item.source,
        importance: item.importance,
        confidence: item.confidence,
      })),
      questions: questions.map((item) => ({
        _id: item._id,
        candidateId: item.candidateId,
        text: item.text,
        importance: item.importance,
        status: item.status,
        answer: item.answer,
      })),
      candidates: candidateDetails,
      outreach: attempts.map((item) => ({
        _id: item._id,
        candidateId: item.candidateId,
        method: item.method,
        status: item.status,
        contentSummary: item.contentSummary,
        safeError: item.safeError,
        updatedAt: item.updatedAt,
      })),
      conversations: conversationDetails,
    }
  },
})
