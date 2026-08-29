# Spec 01 — Authentication and user bootstrap

## Outcome

A visitor can sign in with a passkey, gets one canonical Convex user record, stays
signed in across refreshes, and cannot access another user's data. This is the
first implementation spec and is governed by Spec 00.

## Dependencies

None beyond the existing Convex + TanStack Start application.

## Scope

- Install and register `@convex-dev/auth`.
- Use passkeys as the MVP provider.
- Add the required server auth configuration and client provider.
- Add a protected application shell and sign-in/sign-out UI.
- Create or reconcile a user record immediately after authentication.
- Establish reusable authorization helpers for later specs.

## Data model

Add `users` with:

```ts
{
  tokenIdentifier: string,
  name?: string,
  email?: string,
  createdAt: number,
  updatedAt: number,
}
```

Indexes:

- `by_token_identifier` on `tokenIdentifier`.

`tokenIdentifier` is the canonical auth identity. Do not use email as identity and
do not accept a user ID from the client for authorization.

## Backend contracts

- `users.ensureCurrentUser(): Id<"users">` — authenticated mutation that upserts
  by `identity.tokenIdentifier`; safe under retries and concurrent tabs.
- `users.current()` — authenticated query returning only the current user's public
  profile.
- `lib/auth.requireIdentity(ctx)` — returns identity or throws an authorization
  error.
- `lib/auth.requireCurrentUser(ctx)` — resolves the indexed user record.
- `lib/auth.requireOwnedRequest(ctx, requestId)` — introduced as a signature now
  and implemented when requests exist in Spec 03.

## Implementation steps

1. Add the auth component to `convex/convex.config.ts`.
2. Define the passkey provider in `convex/auth.ts`.
3. Generate `JWT_PRIVATE_KEY` and `JWKS` headlessly with `jose`; set those plus
   `SITE_URL` in the target Convex deployment. Never commit generated key files.
4. Add `convex/auth.config.ts`; a missing file is a release blocker.
5. Wrap the application with `ConvexAuthProvider` while preserving the existing
   Convex React Query integration.
6. Add protected-route behavior with explicit loading, signed-out, and signed-in
   states.
7. On the first authenticated render call `ensureCurrentUser`; display a recoverable
   bootstrap error instead of looping.
8. Remove the starter's anonymous-viewer behavior from protected product routes.

## UX requirements

- Signed-out users see a focused product introduction and passkey sign-in.
- Signed-in users see their name/email when available and a sign-out action.
- Authentication loading does not flash protected content.
- Auth errors have retry guidance without exposing configuration values.

## Acceptance criteria

- A real passkey registration and sign-in round-trip succeeds.
- Refreshing the app preserves the authenticated session.
- Repeated bootstrap calls create exactly one user row.
- Signing out removes access to protected routes.
- Two authenticated test identities cannot read or mutate one another's records.
- Missing or invalid auth deployment configuration fails visibly during verification.

## Tests

- Unit test identity-to-user reconciliation logic.
- Convex tests for first bootstrap, repeat bootstrap, concurrent bootstrap, signed-out
  rejection, and cross-user denial.
- Browser smoke test: register/sign in, refresh, sign out.

## Non-goals

OAuth, passwords, roles, organizations, admin screens, and account deletion.
