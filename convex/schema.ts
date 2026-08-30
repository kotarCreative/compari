import { authTables } from '@convex-dev/auth/server'
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const inboxProvisioningStatus = v.union(
  v.literal('pending'),
  v.literal('provisioning'),
  v.literal('ready'),
  v.literal('retryable_failure'),
  v.literal('permanent_failure'),
)
export const jobStatus = v.union(
  v.literal('pending'),
  v.literal('running'),
  v.literal('succeeded'),
  v.literal('retryable_failure'),
  v.literal('permanent_failure'),
  v.literal('needs_user'),
)
const requestStatus = v.union(
  v.literal('draft'),
  v.literal('researching'),
  v.literal('contacting'),
  v.literal('collecting_responses'),
  v.literal('evaluating'),
  v.literal('awaiting_selection'),
  v.literal('completed'),
  v.literal('cancelled'),
)
const candidateStatus = v.union(
  v.literal('discovered'),
  v.literal('researching'),
  v.literal('qualified'),
  v.literal('rejected'),
  v.literal('queued_for_contact'),
  v.literal('contacted'),
  v.literal('responded'),
  v.literal('proposal_received'),
  v.literal('declined'),
)
const jsonEnvelope = v.object({ schemaVersion: v.literal(1), value: v.any() })
const { users: _authUsers, ...remainingAuthTables } = authTables

export default defineSchema({
  ...remainingAuthTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    tokenIdentifier: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    agentMailInboxId: v.optional(v.string()),
    agentEmailAddress: v.optional(v.string()),
    inboxUsername: v.optional(v.string()),
    inboxProvisioningStatus: v.optional(inboxProvisioningStatus),
    inboxProvisioningError: v.optional(v.string()),
    inboxProvisioningAttempts: v.optional(v.number()),
  })
    .index('by_token_identifier', ['tokenIdentifier'])
    .index('email', ['email'])
    .index('phone', ['phone']),
  sideEffectJobs: defineTable({
    userId: v.id('users'),
    kind: v.union(
      v.literal('provision_inbox'),
      v.literal('extract_requirements'),
      v.literal('discover_providers'),
      v.literal('research_candidate'),
      v.literal('rank_candidates'),
      v.literal('send_outreach_email'),
      v.literal('submit_contact_form'),
      v.literal('process_inbound_message'),
      v.literal('extract_provider_response'),
      v.literal('send_follow_up'),
      v.literal('evaluate_request'),
      v.literal('demo_flow'),
    ),
    idempotencyKey: v.string(),
    status: jobStatus,
    attemptCount: v.number(),
    maxAttempts: v.optional(v.number()),
    requestId: v.optional(v.id('procurementRequests')),
    candidateId: v.optional(v.id('requestCandidates')),
    outreachAttemptId: v.optional(v.id('outreachAttempts')),
    questionId: v.optional(v.id('questions')),
    inputVersion: v.optional(v.number()),
    claimToken: v.optional(v.string()),
    claimedAt: v.optional(v.number()),
    leaseExpiresAt: v.optional(v.number()),
    scheduledAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    lastErrorCategory: v.optional(
      v.union(
        v.literal('validation'),
        v.literal('authorization'),
        v.literal('retryable_external'),
        v.literal('permanent_external'),
        v.literal('needs_user'),
        v.literal('invariant'),
      ),
    ),
    lastErrorSummary: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_idempotency_key', ['idempotencyKey'])
    .index('by_status_and_created_at', ['status', 'createdAt'])
    .index('by_status_and_scheduled_at', ['status', 'scheduledAt'])
    .index('by_user_and_kind', ['userId', 'kind'])
    .index('by_request_id_and_created_at', ['requestId', 'createdAt'])
    .index('by_request_id_and_kind_and_status_and_input_version', ['requestId', 'kind', 'status', 'inputVersion']),
  procurementRequests: defineTable({
    userId: v.id('users'),
    prompt: v.string(),
    title: v.string(),
    location: v.optional(v.string()),
    status: requestStatus,
    automationPaused: v.boolean(),
    version: v.number(),
    researchStatus: v.union(
      v.literal('not_started'),
      v.literal('in_progress'),
      v.literal('complete'),
      v.literal('empty'),
    ),
    candidateCounts: v.object({
      discovered: v.number(),
      researching: v.number(),
      qualified: v.number(),
      rejected: v.number(),
      queuedForContact: v.number(),
      contacted: v.number(),
      responded: v.number(),
    }),
    selectedCandidateId: v.optional(v.id('requestCandidates')),
    selectedProposalId: v.optional(v.id('proposals')),
    selectedAt: v.optional(v.number()),
    agentThreadId: v.optional(v.string()),
    evaluationInputVersion: v.optional(v.number()),
    evaluationPreference: v.optional(v.string()),
    demoKey: v.optional(v.string()),
    rankingStatus: v.optional(v.union(v.literal('pending'), v.literal('running'), v.literal('ready'), v.literal('retryable_failure'), v.literal('needs_user'))),
    rankingError: v.optional(v.string()),
    rankingVersion: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_id_and_updated_at', ['userId', 'updatedAt'])
    .index('by_user_id_and_demo_key', ['userId', 'demoKey']),
  requirements: defineTable({
    requestId: v.id('procurementRequests'),
    key: v.string(),
    label: v.string(),
    value: jsonEnvelope,
    kind: v.union(
      v.literal('hard_constraint'),
      v.literal('preference'),
      v.literal('information'),
    ),
    source: v.union(v.literal('user'), v.literal('inference')),
    importance: v.optional(v.number()),
    confidence: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_request_id', ['requestId'])
    .index('by_request_id_and_key', ['requestId', 'key']),
  businesses: defineTable({
    canonicalName: v.string(),
    normalizedDomain: v.string(),
    website: v.string(),
    location: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_domain', ['normalizedDomain']),
  requestCandidates: defineTable({
    requestId: v.id('procurementRequests'),
    businessId: v.id('businesses'),
    status: candidateStatus,
    qualificationSummary: v.optional(v.string()),
    rejectionSummary: v.optional(v.string()),
    shortlistReason: v.optional(v.string()),
    shortlistRank: v.optional(v.number()),
    recommendationStatus: v.optional(v.union(v.literal('unranked'), v.literal('recommended'), v.literal('not_recommended'), v.literal('selected'))),
    recommendationScore: v.optional(v.number()),
    recommendationReason: v.optional(v.string()),
    recommendationCaveats: v.optional(v.array(v.string())),
    recommendationVersion: v.optional(v.number()),
    version: v.number(),
    inputVersion: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_request_id', ['requestId'])
    .index('by_request_id_and_business_id', ['requestId', 'businessId'])
    .index('by_request_id_and_status', ['requestId', 'status'])
    .index('by_request_id_and_recommendation_status', ['requestId', 'recommendationStatus']),
  contactEndpoints: defineTable({
    businessId: v.id('businesses'),
    type: v.union(
      v.literal('email'),
      v.literal('contact_form'),
      v.literal('phone'),
      v.literal('manual'),
    ),
    value: v.string(),
    verificationState: v.union(
      v.literal('unverified'),
      v.literal('public'),
      v.literal('verified'),
      v.literal('needs_user'),
    ),
    metadata: jsonEnvelope,
    discoveryEvidence: v.object({
      url: v.string(),
      excerpt: v.optional(v.string()),
      observedAt: v.number(),
      confidence: v.number(),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_business_id_and_type', ['businessId', 'type'])
    .index('by_business_id_and_value', ['businessId', 'value']),
  facts: defineTable({
    requestId: v.id('procurementRequests'),
    candidateId: v.optional(v.id('requestCandidates')),
    businessId: v.optional(v.id('businesses')),
    key: v.string(),
    label: v.string(),
    value: jsonEnvelope,
    sourceType: v.union(
      v.literal('website'),
      v.literal('provider'),
      v.literal('user'),
      v.literal('inference'),
    ),
    sourceReference: v.object({
      url: v.optional(v.string()),
      excerpt: v.optional(v.string()),
      externalId: v.optional(v.string()),
    }),
    sourceMessageId: v.optional(v.id('providerMessages')),
    confidence: v.number(),
    observedAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_request_id', ['requestId'])
    .index('by_candidate_id', ['candidateId'])
    .index('by_business_id', ['businessId'])
    .index('by_source_message_id_and_key', ['sourceMessageId', 'key']),
  questions: defineTable({
    requestId: v.id('procurementRequests'),
    candidateId: v.optional(v.id('requestCandidates')),
    text: v.string(),
    importance: v.union(v.literal('required'), v.literal('useful')),
    status: v.union(
      v.literal('open'),
      v.literal('answered'),
      v.literal('resolved'),
    ),
    answer: v.optional(v.string()),
    supportingFactIds: v.array(v.id('facts')),
    providerMessageId: v.optional(v.id('providerMessages')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_request_id', ['requestId'])
    .index('by_request_id_and_status', ['requestId', 'status']),
  outreachAttempts: defineTable({
    requestId: v.id('procurementRequests'),
    candidateId: v.id('requestCandidates'),
    endpointId: v.id('contactEndpoints'),
    method: v.union(v.literal('email'), v.literal('form')),
    status: jobStatus,
    jobId: v.id('sideEffectJobs'),
    vendorMessageId: v.optional(v.string()),
    vendorSubmissionId: v.optional(v.string()),
    contentSummary: v.string(),
    safeError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_request_id', ['requestId'])
    .index('by_request_id_and_status', ['requestId', 'status'])
    .index('by_candidate_id_and_status', ['candidateId', 'status'])
    .index('by_job_id', ['jobId'])
    .index('by_vendor_message_id', ['vendorMessageId']),
  conversations: defineTable({
    requestId: v.id('procurementRequests'),
    candidateId: v.id('requestCandidates'),
    inboxId: v.string(),
    agentMailThreadId: v.string(),
    status: v.union(
      v.literal('active'),
      v.literal('waiting_on_provider'),
      v.literal('waiting_on_user'),
      v.literal('completed'),
    ),
    lastMessageAt: v.optional(v.number()),
    lastInboundMessageId: v.optional(v.id('providerMessages')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_agent_mail_thread_id', ['agentMailThreadId'])
    .index('by_request_id_and_candidate_id', ['requestId', 'candidateId']),
  providerMessages: defineTable({
    conversationId: v.id('conversations'),
    direction: v.union(v.literal('inbound'), v.literal('outbound')),
    participants: v.array(v.string()),
    subject: v.string(),
    sanitizedBody: v.string(),
    agentMailMessageId: v.string(),
    attachments: jsonEnvelope,
    extractionVersion: v.optional(v.number()),
    occurredAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_external_message_id', ['agentMailMessageId'])
    .index('by_conversation_id_and_created_at', [
      'conversationId',
      'createdAt',
    ]),
  proposals: defineTable({
    requestId: v.id('procurementRequests'),
    candidateId: v.id('requestCandidates'),
    status: v.union(
      v.literal('draft'),
      v.literal('received'),
      v.literal('superseded'),
      v.literal('withdrawn'),
    ),
    summary: v.string(),
    attributes: jsonEnvelope,
    confidence: v.number(),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_request_id', ['requestId'])
    .index('by_candidate_id', ['candidateId'])
    .index('by_request_id_and_candidate_id', ['requestId', 'candidateId'])
    .index('by_candidate_id_and_version', ['candidateId', 'version']),
  evaluations: defineTable({
    requestId: v.id('procurementRequests'),
    inputVersion: v.number(),
    criteria: jsonEnvelope,
    results: jsonEnvelope,
    recommendation: v.string(),
    generatedAt: v.number(),
  })
    .index('by_request_id_and_generated_at', ['requestId', 'generatedAt'])
    .index('by_request_id_and_input_version', ['requestId', 'inputVersion']),
  uiViews: defineTable({
    requestId: v.id('procurementRequests'),
    label: v.string(),
    viewType: v.union(
      v.literal('comparison'),
      v.literal('recommendation'),
      v.literal('provider_cards'),
      v.literal('comparison_matrix'),
      v.literal('ranking'),
      v.literal('bar'),
      v.literal('timeline'),
      v.literal('difference'),
      v.literal('missing_information'),
      v.literal('requirements'),
    ),
    configuration: jsonEnvelope,
    inputVersion: v.number(),
    generatedAt: v.number(),
  })
    .index('by_request_id_and_generated_at', ['requestId', 'generatedAt'])
    .index('by_request_id_and_input_version', ['requestId', 'inputVersion']),
  activityEvents: defineTable({
    requestId: v.id('procurementRequests'),
    candidateId: v.optional(v.id('requestCandidates')),
    eventType: v.string(),
    safeMessage: v.string(),
    correlationId: v.string(),
    createdAt: v.number(),
  }).index('by_request_id_and_created_at', ['requestId', 'createdAt']),
  webhookEvents: defineTable({
    provider: v.string(),
    externalEventId: v.string(),
    status: jobStatus,
    attemptCount: v.number(),
    safeError: v.optional(v.string()),
    eventType: v.optional(v.string()),
    inboxId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    messageId: v.optional(v.string()),
    proposedCandidateId: v.optional(v.id('requestCandidates')),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
  }).index('by_provider_and_external_event_id', [
    'provider',
    'externalEventId',
  ]),
})
