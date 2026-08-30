import { getAuthUserId } from '@convex-dev/auth/server'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc, Id } from '../_generated/dataModel'

type AuthCtx = QueryCtx | MutationCtx

export async function requireIdentity(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('authorization: authentication required')
  return identity
}

export async function requireCurrentUser(ctx: AuthCtx): Promise<Doc<'users'>> {
  const identity = await requireIdentity(ctx)
  const user = await ctx.db
    .query('users')
    .withIndex('by_token_identifier', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique()
  if (!user) throw new Error('authorization: user bootstrap is incomplete')
  return user
}

// Requests arrive in Spec 03. Keeping this helper named now prevents callers
// from accepting an arbitrary user ID as an authorization shortcut.
export async function requireOwnedRequest(
  ctx: AuthCtx,
  requestId: Id<'procurementRequests'>,
) {
  const user = await requireCurrentUser(ctx)
  const request = await ctx.db.get('procurementRequests', requestId)
  if (!request || request.userId !== user._id)
    throw new Error('authorization: request is not available')
  return { user, request }
}

export async function authUserId(ctx: MutationCtx): Promise<Id<'users'>> {
  await requireIdentity(ctx)
  const userId = await getAuthUserId(ctx)
  if (!userId)
    throw new Error(
      'authorization: authenticated account is missing its user record',
    )
  return userId
}
