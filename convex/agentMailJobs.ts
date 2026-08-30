import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, internalQuery } from './_generated/server'
import { transitionInboxProvisioning } from './domain/inboxProvisioning'

export const claimProvisioning = internalMutation({
  args: { userId: v.id('users'), jobId: v.id('sideEffectJobs') },
  returns: v.union(
    v.null(),
    v.object({ username: v.string(), displayName: v.string(), claimToken: v.string() }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get('users', args.userId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (
      !user ||
      !job ||
      job.userId !== args.userId ||
      job.status !== 'pending' &&
      job.status !== 'retryable_failure' &&
      !(job.status === 'running' && (job.leaseExpiresAt ?? 0) <= Date.now())
    )
      return null
    transitionInboxProvisioning(
      user.inboxProvisioningStatus ?? 'pending',
      'provisioning',
    )
    const now = Date.now()
    const claimToken = `${job._id}:${job.attemptCount + 1}:${now}`
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: 'running',
      attemptCount: job.attemptCount + 1,
      claimedAt: now,
      claimToken,
      leaseExpiresAt: now + 5 * 60_000,
      updatedAt: now,
    })
    await ctx.db.patch('users', user._id, {
      inboxProvisioningStatus: 'provisioning',
      inboxProvisioningAttempts: (user.inboxProvisioningAttempts ?? 0) + 1,
      updatedAt: now,
    })
    return {
      username: user.inboxUsername ?? 'buyer',
      displayName: user.name ?? 'Compari buyer agent',
      claimToken,
    }
  },
})

export const completeProvisioning = internalMutation({
  args: {
    userId: v.id('users'),
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
    inboxId: v.string(),
    emailAddress: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get('users', args.userId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (!user || !job || job.userId !== args.userId || job.status !== 'running' || job.claimToken !== args.claimToken)
      throw new Error('invariant: stale inbox provisioning completion')
    transitionInboxProvisioning(
      user.inboxProvisioningStatus ?? 'pending',
      'ready',
    )
    const now = Date.now()
    await ctx.db.patch('users', user._id, {
      agentMailInboxId: args.inboxId,
      agentEmailAddress: args.emailAddress,
      inboxProvisioningStatus: 'ready',
      inboxProvisioningError: undefined,
      updatedAt: now,
    })
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: 'succeeded',
      completedAt: now,
      claimToken: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    })
    return null
  },
})

export const failProvisioning = internalMutation({
  args: {
    userId: v.id('users'),
    jobId: v.id('sideEffectJobs'),
    claimToken: v.string(),
    category: v.union(
      v.literal('retryable_external'),
      v.literal('permanent_external'),
    ),
    summary: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get('users', args.userId)
    const job = await ctx.db.get('sideEffectJobs', args.jobId)
    if (!user || !job || job.userId !== args.userId || job.status !== 'running' || job.claimToken !== args.claimToken)
      throw new Error('invariant: stale inbox provisioning failure')
    const target =
      args.category === 'retryable_external' && job.attemptCount < 3
        ? 'retryable_failure'
        : 'permanent_failure'
    transitionInboxProvisioning(
      user.inboxProvisioningStatus ?? 'pending',
      target,
    )
    const now = Date.now()
    await ctx.db.patch('users', user._id, {
      inboxProvisioningStatus: target,
      inboxProvisioningError: args.summary,
      updatedAt: now,
    })
    await ctx.db.patch('sideEffectJobs', job._id, {
      status: target,
      lastErrorCategory: args.category,
      lastErrorSummary: args.summary,
      claimToken: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    })
    if (target === 'retryable_failure')
      await ctx.scheduler.runAfter(
        1_000 * 2 ** job.attemptCount,
        internal.agentMail.provisionUserInbox,
        { userId: args.userId, jobId: args.jobId },
      )
    return null
  },
})

export const getProvisioning = internalQuery({
  args: { userId: v.id('users') },
  returns: v.union(
    v.null(),
    v.object({
      inboxUsername: v.optional(v.string()),
      inboxProvisioningStatus: v.optional(
        v.union(
          v.literal('pending'),
          v.literal('provisioning'),
          v.literal('ready'),
          v.literal('retryable_failure'),
          v.literal('permanent_failure'),
        ),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get('users', args.userId)
    return user
      ? {
          inboxUsername: user.inboxUsername,
          inboxProvisioningStatus: user.inboxProvisioningStatus,
        }
      : null
  },
})
