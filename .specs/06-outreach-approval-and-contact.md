# Spec 06 — Outreach approval and provider contact

## Outcome

The user approves an exact shortlist, then the system contacts 3–5 providers through
AgentMail email or Firecrawl forms. No provider contact occurs before approval.

## Dependencies

Specs 00–05 and a ready per-user AgentMail inbox.

## Authorization model

Approval is a durable, request-scoped command containing:

- Exact candidate IDs and selected endpoint IDs.
- A preview/version of the request facts used in outreach.
- The approved maximum provider count.
- Approval timestamp and authenticated user ID from server identity.

Website/email content can influence message content but can never create approval.
Changing recipients or material scope after approval requires a new approval.

## Workflow

1. `outreach.preview({ requestId, candidateIds })` produces deterministic previews
   of recipient, method, subject/form fields, disclosure, and known facts.
2. The UI presents all inferred recipients and content for confirmation.
3. `outreach.approve(...)` verifies ownership, request state/version, candidate
   qualification, inbox readiness, and the 3–5 contact cap.
4. One `outreachAttempt` and side-effect job is written per provider, then internal
   actions are scheduled.
5. Email jobs use `AgentMailPort.sendMessage`; form jobs use
   `WebResearchPort.submitContactForm` with the user's stable agent address as reply
   email.
6. Results update attempts, candidate status, conversation mapping, and activity.

## Message policy

Initial outreach must:

- State that the agent is coordinating options on behalf of a user.
- Include only approved request details.
- Ask concise unresolved questions needed to compare options.
- Avoid commitments, negotiation claims, invented facts, or sensitive data not
  needed by the provider.
- Include a trustworthy reply path and plain-text body.

Run outbound secret/recipient/personal-data validation before sending. If validation
fails, create a blocked/needs-review attempt instead of sending.

## Channel rules

Email is preferred when a verified public address exists. Use a quote/contact form
when email is absent or unsuitable. Phone-only, CAPTCHA, payment, login, signature,
or unsupported multi-step flows become manual/`needs_user`.

Never automatically fall back from an uncertain email send to a form submission;
first reconcile the send outcome to prevent duplicate outreach.

## Backend contracts

- `outreach.preview({ requestId, candidateIds })`.
- `outreach.approve({ requestId, requestVersion, selections })`.
- `outreach.listAttempts({ requestId })`.
- Internal email/form execution and completion/failure mutations.

The preview does not authorize the send. Only `approve` creates jobs.

## Acceptance criteria

- No email or form submission can be triggered from a request lacking approval.
- The UI shows exact providers, channels, and content before approval.
- A mixed shortlist can send AgentMail email and submit Firecrawl forms.
- Retries do not duplicate known successful email/form submissions.
- The agent address, not the user's personal email, is used as the form reply address.
- Request transitions to `collecting_responses` after attempts settle.

## Tests

- Policy unit tests for approval/version/provider-count/channel rules.
- Fake adapter tests for send success, unknown timeout, bounce, CAPTCHA, and form
  submission failure.
- Convex tests proving signed-out/cross-user/unapproved calls cannot schedule jobs.
- UI test verifies preview changes invalidate prior confirmation.

## Non-goals

Bulk campaigns, cold-email optimization, phone/SMS, booking, payment, contracts, or
unbounded automatic follow-up.
