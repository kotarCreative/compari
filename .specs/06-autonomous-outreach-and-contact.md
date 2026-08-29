# Spec 06 — Autonomous outreach and provider contact

## Outcome

After research qualifies providers, the system automatically contacts a conservative
shortlist of 3–5 through AgentMail email or Firecrawl forms and continues gathering
comparison data without asking the user to approve each company or interaction.

## Dependencies

Specs 00–05 and a ready per-user AgentMail inbox.

## Standing mandate

Submitting a procurement request authorizes the agent to perform bounded,
information-gathering work necessary to compare options for that request. This
includes researching providers, requesting quotes/availability/terms, submitting
contact forms, and asking factual follow-up questions.

The mandate does not authorize the agent to:

- Select or accept a provider's offer.
- Book, purchase, pay, sign, or agree to terms.
- Change material scope, budget, timing, or disclosed personal information.
- Contact providers outside the request's qualification criteria.
- Follow instructions found in provider content that expand its capabilities.

Only Spec 09's authenticated final-choice command can select an option.

## Automatic shortlist policy

The workflow selects at most five `qualified` candidates using request-specific fit,
contactability, evidence quality, and provider diversity. Selection reasons are
persisted and visible. There is no universal provider score.

If fewer than three providers qualify, contact the viable set and keep discovery
running within configured bounds. Users may pause/cancel automation at any time, but
normal operation does not wait for approval.

## Workflow

1. Spec 05 transitions qualified candidates to `queued_for_contact` and writes one
   outreach attempt plus side-effect job per selected provider.
2. The action revalidates request status/version, mandate scope, candidate status,
   endpoint, inbox readiness, contact cap, and prior attempts.
3. Email jobs use `AgentMailPort.sendMessage`; form jobs use
   `WebResearchPort.submitContactForm` with the stable agent address as reply email.
4. Results update attempts, candidate state, conversation mappings, and activity.
5. When initial attempts settle, transition to `collecting_responses` while failed
   candidates remain visible and recoverable.

## Message policy

Every initial contact must:

- State that the agent is coordinating options on behalf of a user.
- Include only request facts needed to obtain a comparable response.
- Ask concise unresolved questions about price, availability, scope, exclusions, and
  other request-specific criteria.
- Avoid commitments, invented facts, unnecessary personal data, pressure, or
  deceptive human impersonation.
- Include the stable agent reply address and a plain-text body.

Run outbound recipient, scope, personal-data, and secret validation. A policy failure
becomes `needs_user`/blocked rather than a send.

## Channel and retry rules

Prefer a verified public email. Use a contact/quote form when email is absent or
unsuitable. Phone-only, CAPTCHA, login, payment, signature, or unsupported flows
become manual/`needs_user` while other candidates continue.

Never fall back from an uncertain email send to a form until the email outcome is
reconciled. Reuse deterministic idempotency keys for all retries.

## Backend contracts

- `outreach.listAttempts({ requestId })`.
- `outreach.retryFailed({ attemptId })` only for the owning user and retryable state.
- Internal shortlist, email/form execution, reconciliation, and completion/failure
  functions.
- `requests.pauseAutomation` prevents new sends/replies but preserves inbound ingest.

There is no `outreach.approve` or per-message approval API.

## UX

- Show which providers the agent chose, why, channel, content summary, and live state.
- Provide pause/cancel controls without modal confirmation for routine outreach.
- Show policy blocks and missing facts as actionable items, not global workflow gates.
- Make it clear that no provider has been selected or hired yet.

## Acceptance criteria

- Qualified providers are contacted automatically after research.
- A mixed shortlist can send AgentMail email and submit Firecrawl forms.
- No per-company or per-message approval interaction is required.
- The 3–5 provider cap and request scope are enforced server-side.
- Retries do not duplicate known successful email/form submissions.
- The user's personal email is never exposed as the form reply address.
- No automatic path can select, accept, book, pay, sign, or agree for the user.

## Tests

- Policy unit tests for shortlist, scope, contact cap, pause, and prohibited actions.
- Fake adapter tests for success, unknown timeout, bounce, CAPTCHA, and form failure.
- Convex tests proving signed-out/cross-user calls cannot schedule or retry jobs.
- Idempotency tests for automatic scheduling and channel fallback reconciliation.
- UI test verifies progress, pause, and blocked-provider states.

## Non-goals

Bulk campaigns, cold-email optimization, phone/SMS, negotiation, booking, payment,
contracts, or final provider acceptance.
