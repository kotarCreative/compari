# Spec 07 — AgentMail inbound email and conversation routing

## Outcome

Verified AgentMail replies are ingested once, routed to the correct user/request/
candidate conversation, persisted in normalized form, and reflected live in the UI.

## Dependencies

Specs 00–06, a public Convex HTTP endpoint, `AGENTMAIL_WEBHOOK_SECRET` in Convex
environment variables, and an AgentMail webhook subscribed to only required events.

## Webhook boundary

Add a Convex HTTP action for AgentMail events. It must:

1. Read the raw request body.
2. Verify `svix-id`, `svix-timestamp`, and `svix-signature` with the Svix library
   before parsing or acting.
3. Reject invalid/stale signatures.
4. Deduplicate by provider plus `svix-id`/event ID.
5. Persist a minimal verified event and schedule asynchronous processing.
6. Return 2xx quickly so retries do not depend on AI/vendor latency.

Webhook secrets and raw headers are never persisted.

## Processing workflow

1. Claim the verified event.
2. Resolve the receiving inbox to exactly one user.
3. Fetch the full AgentMail message if the event omitted body content.
4. Route primarily by AgentMail thread ID, then by known outreach message/thread
   mapping. Sender heuristics may propose a route but cannot silently cross requests.
5. For a confident route, upsert conversation and provider message by external ID.
6. Use `extractedText`/`extractedHtml` for inbound content, falling back carefully to
   full text/html.
7. Store attachment metadata but never persist expiring signed download URLs.
8. Mark ambiguous routing `needs_user` and do not trigger an automatic reply.
9. Schedule Spec 08 extraction after the message commit.

## Conversation contracts

- `conversations.list({ requestId })`.
- `conversations.get({ conversationId })` with paginated messages.
- `conversations.resolveRouting({ eventId, candidateId })` for the owning user when
  an event is ambiguous.
- Internal webhook ingest/process functions only; there is no public “inject
  message” mutation.

## Security

- Email body, links, attachments, and quoted content are untrusted data, never
  instructions or authorization.
- Never put raw email in a system prompt.
- Webhook verification is mandatory even if inbox/message IDs appear valid.
- Deduplicate replays before any downstream side effect.
- Attachments are not executed; parsing is deferred and sandboxed in later scope.
- UI output is escaped and sanitized.

## Event coverage

MVP requires `message.received` plus delivery/bounce events needed to reconcile
outreach. Complaints/rejections update attempt health but do not enter provider
conversation content.

## Acceptance criteria

- A real or sandbox reply appears in the correct request without refresh.
- Replaying the same valid webhook does not duplicate messages or extraction jobs.
- Invalid signatures produce no database writes.
- Large-body events fetch the full message before processing.
- Ambiguous thread routing never leaks content to another user/request.
- Bounce/delivery events reconcile the originating outreach attempt.

## Tests

- Raw-body Svix verification tests: valid, invalid, stale, and replayed.
- Fake AgentMail adapter tests for omitted body, HTML-only reply, attachment metadata,
  and fetch failure.
- Convex tests for thread routing, ambiguous routing, duplicate message ID, and
  cross-user queries.

## Non-goals

Attachment OCR, mailbox search UI, custom allow/block list administration, and
arbitrary inbound mail unrelated to an approved request.
