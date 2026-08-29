# Spec 05 — Firecrawl provider discovery and research

## Outcome

Firecrawl discovers relevant providers on the open web, researches a bounded set,
and streams candidates, evidence-backed facts, and contact endpoints into Convex.

## Dependencies

Specs 00–04 and `FIRECRAWL_API_KEY` in Convex environment variables.

## Architecture

Replace the starter public `scrapePage` spike with an internal `WebResearchPort`.
The production Firecrawl adapter exposes:

- `searchProviders(query, location, limit)`.
- `researchProvider(url, researchBrief)`.
- `submitContactForm(...)` is defined now but used only by Spec 06.

Use lazy singleton clients if using the SDK. REST is acceptable only inside the
adapter. Neither Firecrawl response types nor raw page content should leak into
domain functions.

## Discovery workflow

1. Build a search plan from the current request and requirements.
2. Search the web with a conservative MVP target of 8–12 discovered candidates.
3. Normalize domains and upsert `businesses`.
4. Create request-specific candidate rows as `discovered`, deduplicated by request
   and business.
5. Schedule bounded research jobs with controlled concurrency.
6. Emit activity events and counters after each durable state change.

## Research workflow

For each candidate:

1. Transition `discovered → researching`.
2. Scrape the homepage and only relevant service/contact/quote pages.
3. Ask the reasoning adapter to extract request-relevant facts, contact endpoints,
   qualification, unresolved questions, and source references.
4. Validate and write all derived records atomically against the candidate version.
5. Transition to `qualified` or `rejected` with a factual reason.

Bound the MVP to at most 10 researched providers and at most 5 pages per provider.
Store extracted snippets/markdown needed for evidence, not unlimited crawl output.

## Evidence requirements

Every website fact includes source URL, observed time, confidence, and a short source
excerpt or snapshot reference. AI inference is labeled separately from an observed
website/provider claim.

Contact endpoints record type, value/URL, verification state, and form metadata such
as required phone/address fields or CAPTCHA presence.

## Resilience

- Search/crawl jobs use deterministic idempotency keys and bounded retry.
- A single provider failure does not fail the request.
- Rate limits pause/retry jobs and remain visible in activity state.
- Unsupported/CAPTCHA forms become `needs_user` or manual endpoints.
- If no viable candidates remain, return to an actionable research-empty state,
  not an infinite spinner.

## UX

Show live aggregate counts and per-provider status:

```text
12 discovered · 7 researched · 5 qualified · 2 rejected
```

Candidate cards show qualification summary, key facts, contact path, missing
information, and evidence links. They do not show a universal provider score.

## Acceptance criteria

- A generic request produces deduplicated providers from Firecrawl search.
- Candidate research updates the UI incrementally without refresh.
- At least one email endpoint and one form endpoint can be represented.
- Every displayed provider claim has provenance.
- No external call occurs from a query/mutation or browser client.
- Research completion automatically selects up to five qualified candidates for
  information gathering, transitions the request to `contacting`, and schedules
  Spec 06 without a user approval step.

## Tests

- Port contract fixtures for search, JS-heavy website, no contact method, duplicate
  domain, malformed response, 429, and timeout.
- Unit tests for domain normalization and qualification state transitions.
- Convex tests for job idempotency, bounded candidate counts, stale writes, and
  cross-user isolation.
- One opt-in Firecrawl sandbox test; default tests use fakes.

## Non-goals

Unbounded site crawling, reputation scoring, phone enrichment, or executing outreach
inside the research adapter.
