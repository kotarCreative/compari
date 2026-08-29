# Spec 02 — Per-user AgentMail inbox provisioning

## Outcome

Every newly bootstrapped user automatically receives one stable, readable AgentMail
inbox owned by their buyer-side agent. Provisioning is asynchronous, idempotent,
observable, and never blocks authentication.

## Dependencies

- Spec 01.
- `AGENTMAIL_API_KEY` stored in Convex environment variables.
- Optional product domain configured outside source; absence uses the AgentMail
  organization default.

## Architecture decision

For MVP, one authenticated user maps to one buyer agent and therefore one inbox.
All provider conversations for that user route internally by AgentMail thread ID,
sender, and Convex records. Do not create one visible email address per request and
do not put request IDs or hashes in the address.

Use the `AgentMailPort` and a TypeScript adapter. The adapter owns the SDK shape;
the workflow receives only the internal `ProvisionedInbox` DTO.

## Data model changes

Extend `users` with:

```ts
{
  agentMailInboxId?: string,
  agentEmailAddress?: string,
  inboxUsername?: string,
  inboxProvisioningStatus:
    | "pending"
    | "provisioning"
    | "ready"
    | "retryable_failure"
    | "permanent_failure",
  inboxProvisioningError?: string,
  inboxProvisioningAttempts: number,
}
```

Add `sideEffectJobs` as specified in Spec 00. Index by `idempotencyKey` and by
`status` plus creation time.

## Username and idempotency rules

- Choose `inboxUsername` once in the user-bootstrap mutation and persist it before
  calling AgentMail.
- Prefer a sanitized readable name such as `alex`, with a short numeric suffix only
  when necessary. Never expose a Convex ID, token identifier, or random hash.
- Use stable AgentMail `clientId`:
  `compari-user-<userId>-inbox-v1`. This value is internal and is not the address.
- Retry with the same username and `clientId`.

## Workflow

1. `ensureCurrentUser` creates a user with status `pending` and schedules
   `internal.agentMail.provisionUserInbox` only for a new/unprovisioned user.
2. The action claims `provision-inbox:<userId>:v1`.
3. The lazy singleton AgentMail adapter calls `client.inboxes.create` with
   `username`, a trustworthy display name, stable `clientId`, and minimal metadata.
4. An internal mutation validates the job claim and writes inbox ID/address, then
   marks both user and job `ready`/`succeeded`.
5. Transient failures record a safe summary and schedule bounded exponential retry.
6. Permanent configuration/collision failures surface a retry/support state.

## Backend contracts

- `users.current()` includes inbox address and provisioning status, never API keys.
- `internal.agentMail.provisionUserInbox({ userId, jobId })`.
- `internal.agentMail.completeProvisioning(...)`.
- `internal.agentMail.failProvisioning(...)`.
- Optional authenticated `agentMail.retryMyInboxProvisioning()` mutation, allowed
  only from a failure state and rate-limited.

## Security rules

- The SDK and `AGENTMAIL_API_KEY` exist only in an action-only adapter.
- Users cannot supply inbox IDs, usernames, domains, or metadata to provisioning.
- Inbox creation is not authorization to send email.
- Never put private user fields in AgentMail metadata.
- No email content is sent to a model in this spec.

## Acceptance criteria

- First successful user bootstrap queues provisioning automatically.
- The UI progresses from provisioning to a visible stable address without refresh.
- Repeat bootstrap/retry calls still produce exactly one AgentMail inbox.
- A second user receives a distinct inbox and cannot inspect the first user's inbox.
- A simulated 429/timeout retries without duplicating the inbox.
- Missing credentials create a safe failure state and do not break sign-in.

## Tests

- Fake `AgentMailPort` contract tests for success, collision, timeout, and retry.
- Convex tests for scheduling once, idempotent completion, stale claim rejection,
  and cross-user denial.
- Optional live test creates only an explicitly named test inbox and records its ID
  for manual cleanup.

## Non-goals

Sending messages, receiving webhooks, custom-domain DNS setup, per-request inboxes,
or exposing mailbox administration to users.
