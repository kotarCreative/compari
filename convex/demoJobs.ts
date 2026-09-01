import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'

export const seed = internalMutation({
  args: { userId: v.id('users') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get('users', args.userId)
    if (!user) return null
    const prior = await ctx.db
      .query('procurementRequests')
      .withIndex('by_user_id_and_demo_key', (q) =>
        q.eq('userId', user._id).eq('demoKey', 'printing-v1'),
      )
      .unique()
    if (prior) return null
    const now = Date.now()
    if (!user.agentMailInboxId)
      await ctx.db.patch('users', user._id, {
        agentMailInboxId: `demo-inbox-${user._id}`,
        agentEmailAddress: 'buyer-demo@demo.agentmail.test',
        inboxProvisioningStatus: 'ready',
        updatedAt: now,
      })
    const inboxId = user.agentMailInboxId ?? `demo-inbox-${user._id}`
    const requestId = await ctx.db.insert('procurementRequests', {
      userId: user._id,
      prompt:
        'I need 500 full-color brochures printed by next Friday. I’d prefer matte paper and want to stay under $700.',
      title: '500 full-color brochures',
      status: 'evaluating',
      automationPaused: false,
      version: 1,
      evaluationInputVersion: 1,
      demoKey: 'printing-v1',
      researchStatus: 'complete',
      candidateCounts: {
        discovered: 0,
        researching: 0,
        qualified: 3,
        rejected: 0,
        queuedForContact: 0,
        contacted: 3,
        responded: 0,
      },
      createdAt: now,
      updatedAt: now,
    })
    const providers = [
      {
        name: 'Northline Print',
        domain: 'northline.demo.test',
        price: '$640',
        availability: 'Available for delivery by next Friday.',
        method: 'email' as const,
      },
      {
        name: 'Prairie Press',
        domain: 'prairie.demo.test',
        price: '$690',
        availability: 'Available with a three-day lead time.',
        method: 'contact_form' as const,
      },
      {
        name: 'River City Print',
        domain: 'rivercity.demo.test',
        price: '$610',
        availability: 'Available after a simulated transient retry.',
        method: 'email' as const,
      },
    ]
    for (const [index, provider] of providers.entries()) {
      const businessId = await ctx.db.insert('businesses', {
        canonicalName: provider.name,
        normalizedDomain: provider.domain,
        website: `https://${provider.domain}`,
        createdAt: now,
        updatedAt: now,
      })
      const candidateId = await ctx.db.insert('requestCandidates', {
        requestId,
        businessId,
        status: 'contacted',
        version: 1,
        inputVersion: 1,
        qualificationSummary:
          'Demo provider with public print-service evidence.',
        createdAt: now,
        updatedAt: now,
      })
      const endpointId = await ctx.db.insert('contactEndpoints', {
        businessId,
        type: provider.method,
        value:
          provider.method === 'email'
            ? `sales@${provider.domain}`
            : `https://${provider.domain}/quote`,
        verificationState: 'verified',
        metadata: { schemaVersion: 1, value: { demoFixture: true } },
        discoveryEvidence: {
          url: `https://${provider.domain}`,
          observedAt: now,
          confidence: 1,
        },
        createdAt: now,
        updatedAt: now,
      })
      const jobId = await ctx.db.insert('sideEffectJobs', {
        userId: user._id,
        kind:
          provider.method === 'email'
            ? 'send_outreach_email'
            : 'submit_contact_form',
        idempotencyKey: `demo-contact:${requestId}:${index}:v1`,
        status: index === 2 ? 'retryable_failure' : 'succeeded',
        attemptCount: index === 2 ? 1 : 1,
        maxAttempts: 2,
        requestId,
        candidateId,
        scheduledAt: now,
        completedAt: index === 2 ? undefined : now,
        lastErrorCategory: index === 2 ? 'retryable_external' : undefined,
        lastErrorSummary:
          index === 2
            ? 'Demo transient delivery failure recovered on retry.'
            : undefined,
        createdAt: now,
        updatedAt: now,
      })
      const attemptId = await ctx.db.insert('outreachAttempts', {
        requestId,
        candidateId,
        endpointId,
        method: provider.method === 'email' ? 'email' : 'form',
        status: index === 2 ? 'retryable_failure' : 'succeeded',
        jobId,
        contentSummary: 'Deterministic demo information request.',
        safeError:
          index === 2 ? 'Demo transient failure; retry recovered.' : undefined,
        createdAt: now,
        updatedAt: now,
      })
      if (index === 2) {
        await ctx.db.patch('sideEffectJobs', jobId, {
          status: 'succeeded',
          attemptCount: 2,
          completedAt: now + 1,
          lastErrorCategory: undefined,
          lastErrorSummary: undefined,
          updatedAt: now + 1,
        })
        await ctx.db.patch('outreachAttempts', attemptId, {
          status: 'succeeded',
          safeError: undefined,
          updatedAt: now + 1,
        })
      }
      const messageId = await ctx.runMutation(
        internal.conversations.ingestProviderMessage,
        {
          externalEventId: `demo-reply-${index}-v1`,
          inboxId,
          threadId: `demo-thread-${index}`,
          messageId: `demo-message-${index}`,
          sender: `sales@${provider.domain}`,
          subject: 'Brochure quote',
          body: `We can print 500 full-color matte brochures for ${provider.price}. ${provider.availability}`,
          occurredAt: now + index,
          candidateId,
        },
      )
      if (messageId) {
        const extractionJob = await ctx.db
          .query('sideEffectJobs')
          .withIndex('by_idempotency_key', (q) =>
            q.eq('idempotencyKey', `extract-provider-response:${messageId}:v1`),
          )
          .unique()
        const claim = extractionJob
          ? await ctx.runMutation(internal.sideEffectJobs.claim, {
              jobId: extractionJob._id,
              kind: 'extract_provider_response',
            })
          : null
        if (extractionJob && claim)
          await ctx.runMutation(internal.reasoningJobs.applyExtraction, {
            providerMessageId: messageId,
            jobId: extractionJob._id,
            claimToken: claim.claimToken,
            dto: {
              schemaVersion: 1,
              facts: [
                {
                  key: 'price',
                  label: 'Quoted price',
                  value: provider.price.slice(1),
                  confidence: 0.9,
                },
                {
                  key: 'availability',
                  label: 'Availability',
                  value: provider.availability,
                  confidence: 0.9,
                },
              ],
              proposal: {
                status: 'complete',
                summary: `${provider.name} supplied a comparable brochure quote.`,
                attributes: {
                  price: provider.price.slice(1),
                  availability: provider.availability,
                },
                missingInformation: [],
              },
              confidence: 0.9,
            },
          })
      }
    }
    await ctx.db.insert('activityEvents', {
      requestId,
      eventType: 'demo_seeded',
      safeMessage:
        'Demo mode seeded deterministic provider fixtures and normalized fixture replies; no real providers were contacted or webhook-verified.',
      correlationId: `demo:${requestId}`,
      createdAt: now,
    })
    return null
  },
})
