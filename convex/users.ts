import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { chooseInboxUsername, inboxJobKey } from './domain/inboxProvisioning'
import { authUserId, requireCurrentUser, requireIdentity } from './lib/auth'
import type { Id } from './_generated/dataModel'
import type { FunctionReference } from 'convex/server'

const agentMailInternal = internal as unknown as {
  agentMail: {
    provisionUserInbox: FunctionReference<
      'action',
      'internal',
      {
        userId: Id<'users'>
        jobId: Id<'sideEffectJobs'>
      },
      null
    >
  }
}

const profileValidator = v.union(
  v.null(),
  v.object({
    _id: v.id('users'),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    agentEmailAddress: v.optional(v.string()),
    inboxProvisioningStatus: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('provisioning'),
        v.literal('ready'),
        v.literal('retryable_failure'),
        v.literal('permanent_failure'),
      ),
    ),
    inboxProvisioningError: v.optional(v.string()),
    inboxProvisioningAttempts: v.optional(v.number()),
  }),
)

export const current = query({
  args: {},
  returns: profileValidator,
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const user = await ctx.db
      .query('users')
      .withIndex('by_token_identifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
    if (!user) return null
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      agentEmailAddress: user.agentEmailAddress,
      inboxProvisioningStatus: user.inboxProvisioningStatus,
      inboxProvisioningError: user.inboxProvisioningError,
      inboxProvisioningAttempts: user.inboxProvisioningAttempts,
    }
  },
})

export const ensureCurrentUser = mutation({
  args: {},
  returns: v.id('users'),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const existing = await ctx.db
      .query('users')
      .withIndex('by_token_identifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
    if (existing) return existing._id
    const userId = await authUserId(ctx)
    const now = Date.now()
    const username = chooseInboxUsername(identity.name ?? identity.email)
    await ctx.db.patch('users', userId, {
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name ?? undefined,
      email: identity.email ?? undefined,
      createdAt: now,
      updatedAt: now,
      inboxUsername: username,
      inboxProvisioningStatus: 'pending',
      inboxProvisioningAttempts: 0,
    })
    const jobId = await ctx.db.insert('sideEffectJobs', {
      userId,
      kind: 'provision_inbox',
      idempotencyKey: inboxJobKey(userId),
      status: 'pending',
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(
      0,
      agentMailInternal.agentMail.provisionUserInbox,
      { userId, jobId },
    )
    return userId
  },
})

export const retryMyInboxProvisioning = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    if (
      user.inboxProvisioningStatus !== 'retryable_failure' &&
      user.inboxProvisioningStatus !== 'permanent_failure'
    )
      throw new Error('validation: inbox provisioning cannot be retried now')
    const job = await ctx.db
      .query('sideEffectJobs')
      .withIndex('by_idempotency_key', (q) =>
        q.eq('idempotencyKey', inboxJobKey(user._id)),
      )
      .unique()
    if (!job) throw new Error('invariant: provisioning job is missing')
    const now = Date.now()
    await ctx.db.patch('users', user._id, {
      inboxProvisioningStatus: 'pending',
      inboxProvisioningError: undefined,
      updatedAt: now,
    })
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: 'pending',
      attemptCount: 0,
      lastErrorCategory: undefined,
      lastErrorSummary: undefined,
      scheduledAt: now,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(
      0,
      agentMailInternal.agentMail.provisionUserInbox,
      { userId: user._id, jobId: job._id },
    )
    return null
  },
})
