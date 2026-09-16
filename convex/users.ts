import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import { chooseInboxUsername, inboxJobKey } from './domain/inboxProvisioning'
import { authUserId, requireCurrentUser, requireIdentity } from './lib/auth'

const profileValidator = v.union(
  v.null(),
  v.object({
    _id: v.id('users'),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    location: v.optional(v.string()),
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
    hasConfirmedName: v.boolean(),
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
      location: user.location,
      agentEmailAddress: user.agentEmailAddress,
      inboxProvisioningStatus: user.inboxProvisioningStatus,
      inboxProvisioningError: user.inboxProvisioningError,
      inboxProvisioningAttempts: user.inboxProvisioningAttempts,
      hasConfirmedName: user.nameConfirmedAt !== undefined,
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
    const profile = {
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name ?? undefined,
      email: identity.email ?? undefined,
      createdAt: now,
      updatedAt: now,
    }
    const authUser = await ctx.db.get('users', userId)
    if (authUser) {
      await ctx.db.patch('users', userId, profile)
      return userId
    }

    // A development data reset can remove the auth user while its browser
    // session remains valid. Recreate an application user keyed by the stable
    // token identifier instead of trapping that session in bootstrap errors.
    return await ctx.db.insert('users', profile)
  },
})

export const completeMyProfile = mutation({
  args: { firstName: v.string(), lastName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const firstName = args.firstName.trim().replace(/\s+/g, ' ')
    const lastName = args.lastName.trim().replace(/\s+/g, ' ')
    if (firstName.length < 1 || firstName.length > 40)
      throw new Error('validation: enter a valid first name')
    if (lastName.length < 1 || lastName.length > 40)
      throw new Error('validation: enter a valid last name')
    const name = `${firstName} ${lastName}`
    if (name.length > 60)
      throw new Error('validation: full name must be 60 characters or fewer')
    const now = Date.now()
    await ctx.db.patch('users', user._id, {
      name,
      nameConfirmedAt: now,
      inboxUsername: user.agentMailInboxId
        ? user.inboxUsername
        : chooseInboxUsername(name),
      updatedAt: now,
    })
    if (user.agentMailInboxId) return null

    const idempotencyKey = inboxJobKey(user._id)
    const existingJob = await ctx.db
      .query('sideEffectJobs')
      .withIndex('by_idempotency_key', (q) =>
        q.eq('idempotencyKey', idempotencyKey),
      )
      .unique()
    const jobId = existingJob
      ? existingJob._id
      : await ctx.db.insert('sideEffectJobs', {
          userId: user._id,
          kind: 'provision_inbox',
          idempotencyKey,
          status: 'pending',
          attemptCount: 0,
          createdAt: now,
          updatedAt: now,
        })
    if (existingJob)
      await ctx.db.patch('sideEffectJobs', existingJob._id, {
        status: 'pending',
        attemptCount: 0,
        lastErrorCategory: undefined,
        lastErrorSummary: undefined,
        scheduledAt: now,
        updatedAt: now,
      })
    await ctx.db.patch('users', user._id, {
      inboxProvisioningStatus: 'pending',
      inboxProvisioningError: undefined,
      inboxProvisioningAttempts: 0,
      updatedAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.agentMail.provisionUserInbox, {
      userId: user._id,
      jobId,
    })
    return null
  },
})

export const setMyLocation = mutation({
  args: { location: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const location = args.location.trim().replace(/\s+/g, ' ')
    if (location.length < 2 || location.length > 160)
      throw new Error(
        'validation: enter a location between 2 and 160 characters',
      )
    await ctx.db.patch('users', user._id, {
      location,
      updatedAt: Date.now(),
    })
    return null
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
    await ctx.scheduler.runAfter(0, internal.agentMail.provisionUserInbox, {
      userId: user._id,
      jobId: job._id,
    })
    return null
  },
})
