import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, internalQuery } from './_generated/server'
import {
  moveCandidateCount,
  transitionCandidate,
  transitionRequest,
} from './domain/workflowState'

const extractedFact = v.object({
  key: v.string(),
  label: v.string(),
  value: v.string(),
  confidence: v.number(),
})
const dtoValidator = v.object({
  schemaVersion: v.literal(1),
  facts: v.array(extractedFact),
  proposal: v.object({
    status: v.union(v.literal('partial'), v.literal('complete')),
    summary: v.string(),
    attributes: v.record(v.string(), v.string()),
    missingInformation: v.array(v.string()),
  }),
  providerQuestion: v.optional(v.string()),
  confidence: v.number(),
})

export const loadMessage = internalQuery({
  args: {
    providerMessageId: v.id('providerMessages'),
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({ body: v.string(), extractionVersion: v.optional(v.number()) }),
  ),
  handler: async (ctx, args) => {
    const [message, job] = await Promise.all([
      ctx.db.get('providerMessages', args.providerMessageId),
      ctx.db.get('sideEffectJobs', args.jobId),
    ])
    return message &&
      job?.kind === 'extract_provider_response' &&
      job.status === 'running' &&
      job.claimToken === args.claimToken
      ? {
          body: message.sanitizedBody,
          extractionVersion: message.extractionVersion,
        }
      : null
  },
})

export const applyExtraction = internalMutation({
  args: {
    providerMessageId: v.id('providerMessages'),
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
    dto: dtoValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [message, job] = await Promise.all([
      ctx.db.get('providerMessages', args.providerMessageId),
      ctx.db.get('sideEffectJobs', args.jobId),
    ])
    if (
      !message ||
      !job ||
      job.kind !== 'extract_provider_response' ||
      job.status !== 'running' ||
      job.claimToken !== args.claimToken ||
      message.direction !== 'inbound'
    )
      return null
    if (message.extractionVersion) {
      await ctx.db.patch('sideEffectJobs', job._id, {
        status: 'succeeded',
        completedAt: Date.now(),
        claimToken: undefined,
        leaseExpiresAt: undefined,
        updatedAt: Date.now(),
      })
      return null
    }
    const conversation = await ctx.db.get(
      'conversations',
      message.conversationId,
    )
    if (!conversation) return null
    const request = await ctx.db.get(
      'procurementRequests',
      conversation.requestId,
    )
    const candidate = await ctx.db.get(
      'requestCandidates',
      conversation.candidateId,
    )
    if (
      !request ||
      !candidate ||
      request.status === 'cancelled' ||
      request.status === 'completed'
    )
      return null
    const now = Date.now()
    for (const fact of args.dto.facts.slice(0, 8)) {
      const existing = await ctx.db
        .query('facts')
        .withIndex('by_source_message_id_and_key', (q) =>
          q.eq('sourceMessageId', message._id).eq('key', fact.key),
        )
        .unique()
      if (!existing)
        await ctx.db.insert('facts', {
          requestId: request._id,
          candidateId: candidate._id,
          businessId: candidate.businessId,
          key: fact.key.slice(0, 80),
          label: fact.label.slice(0, 120),
          value: { schemaVersion: 1, value: fact.value },
          sourceType: 'provider',
          sourceReference: { externalId: message.agentMailMessageId },
          sourceMessageId: message._id,
          confidence: fact.confidence,
          observedAt: message.occurredAt,
          createdAt: now,
        })
    }
    if (args.dto.providerQuestion) {
      const open = await ctx.db
        .query('questions')
        .withIndex('by_request_id_and_status', (q) =>
          q.eq('requestId', request._id).eq('status', 'open'),
        )
        .take(100)
      if (
        !open.some(
          (item) =>
            item.candidateId === candidate._id &&
            item.text === args.dto.providerQuestion,
        )
      ) {
        await ctx.db.insert('questions', {
          requestId: request._id,
          candidateId: candidate._id,
          text: args.dto.providerQuestion.slice(0, 500),
          importance: 'useful',
          status: 'open',
          supportingFactIds: [],
          providerMessageId: message._id,
          createdAt: now,
          updatedAt: now,
        })
        await ctx.db.patch('conversations', conversation._id, {
          status: 'waiting_on_user',
          updatedAt: now,
        })
      }
    }
    const previous = await ctx.db
      .query('proposals')
      .withIndex('by_candidate_id_and_version', (q) =>
        q.eq('candidateId', candidate._id),
      )
      .order('desc')
      .first()
    if (previous)
      await ctx.db.patch('proposals', previous._id, {
        status: 'superseded',
        updatedAt: now,
      })
    const proposalId = await ctx.db.insert('proposals', {
      requestId: request._id,
      candidateId: candidate._id,
      status: args.dto.facts.length ? 'received' : 'draft',
      summary: args.dto.proposal.summary,
      attributes: {
        schemaVersion: 1,
        value: {
          ...args.dto.proposal.attributes,
          missingInformation: args.dto.proposal.missingInformation,
        },
      },
      confidence: args.dto.confidence,
      version: (previous?.version ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch('providerMessages', message._id, {
      extractionVersion: 1,
    })
    const candidateStatus =
      candidate.status === 'contacted'
        ? transitionCandidate('contacted', 'responded')
        : candidate.status
    await ctx.db.patch('requestCandidates', candidate._id, {
      status: candidateStatus,
      version: candidate.version + 1,
      updatedAt: now,
    })
    const nextVersion = (request.evaluationInputVersion ?? request.version) + 1
    let nextStatus = request.status
    if (request.status === 'contacting') {
      transitionRequest('contacting', 'collecting_responses')
      transitionRequest('collecting_responses', 'evaluating')
      nextStatus = 'evaluating'
    } else if (request.status === 'collecting_responses') {
      transitionRequest('collecting_responses', 'evaluating')
      nextStatus = 'evaluating'
    }
    const receivedFirstResponse = candidate.status === 'contacted'
    await ctx.db.patch('procurementRequests', request._id, {
      status: nextStatus,
      evaluationInputVersion: nextVersion,
      version: request.version + 1,
      candidateCounts: receivedFirstResponse
        ? moveCandidateCount(request.candidateCounts, 'contacted', 'responded')
        : request.candidateCounts,
      updatedAt: now,
    })
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: 'succeeded',
      completedAt: now,
      claimToken: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    })
    const jobId = await ctx.db.insert('sideEffectJobs', {
      userId: request.userId,
      kind: 'evaluate_request',
      idempotencyKey: `evaluate:${request._id}:v${nextVersion}`,
      status: 'pending',
      attemptCount: 0,
      maxAttempts: 2,
      requestId: request._id,
      candidateId: candidate._id,
      inputVersion: nextVersion,
      scheduledAt: now,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('activityEvents', {
      requestId: request._id,
      candidateId: candidate._id,
      eventType: 'provider_response_extracted',
      safeMessage: 'Provider response produced an evidence-backed proposal.',
      correlationId: `${proposalId}:${jobId}`,
      createdAt: now,
    })
    await ctx.scheduler.runAfter(200, internal.evaluationsWorkflow.generate, {
      requestId: request._id,
      jobId,
    })
    return null
  },
})
