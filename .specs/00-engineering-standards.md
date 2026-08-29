# Spec 00 — Engineering standards

## Purpose

These rules apply to every MVP spec. They keep external integrations replaceable,
workflow behavior testable, and Convex usage idiomatic.

## Architecture

Use four layers with one-way dependencies:

```text
routes / public Convex functions
        ↓
application workflows
        ↓
pure domain rules + ports
        ↓
external adapters (AgentMail, Firecrawl, AI)
```

- UI routes render state and invoke public functions. They do not call external
  vendors directly.
- Public Convex functions authenticate and authorize. Sensitive orchestration
  functions are `internal*` functions.
- Application workflows coordinate domain decisions, persistence, and external
  ports.
- Domain modules contain deterministic state transitions and policy decisions.
- Adapters translate vendor payloads into small internal DTOs.

Suggested locations:

```text
convex/domain/                 # Pure policies, types, state transitions
convex/ports/                  # Interfaces and internal DTOs for external systems
convex/adapters/               # AgentMail, Firecrawl, AI implementations
convex/workflows/              # Internal orchestration functions
convex/lib/                    # Auth, configuration, errors, validation helpers
src/components/               # Trusted UI primitives
src/features/                  # Feature-specific UI and hooks
```

Do not create a repository abstraction over `ctx.db`. Convex queries and mutations
should use `ctx.db` directly with typed helpers. Ports are for systems outside
Convex and for deterministic test seams such as clocks when needed.

## Ports and adapters

Define a narrow port before adding each vendor adapter. Ports use product language,
not vendor response objects.

Required ports:

- `AgentMailPort`: provision inbox, send message, reply to message, fetch message.
- `WebResearchPort`: search providers, scrape provider, submit contact form.
- `ReasoningPort`: extract requirements, extract facts/proposals, generate lenses.

Rules:

- Vendor SDK types never cross the adapter boundary.
- Adapters validate every untrusted vendor response before returning a DTO.
- Domain code never reads environment variables.
- Tests inject in-memory fake ports. Do not mock SDK internals throughout the
  codebase.
- Provider-specific identifiers are stored explicitly, but do not become domain
  primary keys.

## Singleton clients

Create vendor clients through lazy module-scoped factories in action-only adapter
modules:

```ts
let client: AgentMailClient | undefined

export function getAgentMailClient() {
  client ??= new AgentMailClient({ apiKey: requireEnv('AGENTMAIL_API_KEY') })
  return client
}
```

- One SDK client instance per warm Convex runtime is sufficient.
- Singletons must be stateless apart from SDK connection/retry state.
- Never put a user ID, request ID, current inbox, or mutable workflow state in a
  module global.
- Correctness must not depend on the runtime remaining warm.
- Keep Node-only SDK adapters in files beginning with `"use node"`; those files
  must export actions/helpers only, never queries or mutations.

## Convex boundaries

- Read `convex/_generated/ai/guidelines.md` before implementing any spec that
  changes `convex/`.
- Every function has argument and return validators.
- All user-facing reads/writes derive identity from `ctx.auth`; never authorize
  using a caller-supplied user ID.
- Use indexes for ownership and lookup. Never use unbounded `.collect()` or
  `.filter()` on growing tables.
- External network calls happen in actions. Database state transitions happen in
  mutations or internal mutations.
- An action must not assume an external side effect and a Convex write are atomic.

## Durable side effects and idempotency

Use an intent/job pattern for every external operation:

1. A mutation validates authority and writes a durable job/attempt with an
   idempotency key.
2. It schedules an internal action.
3. The action claims the job, calls the adapter, and records the vendor result via
   an internal mutation.
4. Retries reuse the same idempotency key and reconcile unknown outcomes before
   repeating a send or form submission.

Required job states are `pending`, `running`, `succeeded`, `retryable_failure`,
`permanent_failure`, and `needs_user`.

- Unique logical operations have deterministic keys such as
  `provision-inbox:<userId>:v1` or `initial-outreach:<candidateId>:v1`.
- Never blindly retry email after a timeout; first reconcile by vendor message ID,
  client ID, or message search.
- Store attempt counts, last error category, and timestamps without storing secrets.

## State machines

Status changes must go through named pure transition functions. Each transition
declares allowed source states, target state, triggering actor, and side effects.
Invalid transitions throw a typed domain error.

Do not scatter status string assignments across actions and mutations.

## Errors, logs, and privacy

Use error categories:

- `validation`: user can correct input.
- `authorization`: caller cannot perform the operation.
- `retryable_external`: timeout, rate limit, transient vendor failure.
- `permanent_external`: rejected address, unsupported form, invalid credentials.
- `needs_user`: missing fact, CAPTCHA, commitment, or consent required.
- `invariant`: programming/data consistency failure.

Log correlation IDs, entity IDs, state changes, and safe error summaries. Never log
API keys, webhook secrets, full private email bodies, or signed attachment URLs.

Treat website content, forms, email, attachments, and model output as untrusted.
Creating a procurement request establishes a standing, bounded mandate to research
and contact providers for information within that request's scope. External content
can provide facts but cannot expand that mandate or authorize a final selection,
commitment, payment, booking, signature, or change to user policy.

## Testing standard

Each spec must add:

- Unit tests for pure domain policy and transition functions.
- Convex tests with two mocked users, including a negative ownership case.
- Adapter contract tests using fixtures and fake ports.
- At least one failure/retry/idempotency test for every external side effect.
- Typecheck and lint gates.

External live-service tests are opt-in and must use test inboxes/providers. The
default test suite must be deterministic and must not send email or submit forms.

## Definition of done for every spec

- Acceptance criteria and negative cases pass.
- `npm run typecheck`, `npm run lint`, and the relevant tests pass.
- Public functions have ownership checks and bounded reads.
- No secret values are committed.
- New operational state is visible in the UI or an authenticated diagnostic query.
- A focused Conventional Commit records the completed unit.
