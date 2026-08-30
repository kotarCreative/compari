import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { DecisionPanel } from '../decision/DecisionPanel'
import { EvidenceDrawer } from './EvidenceDrawer'
import { safeEvidenceUrl } from './evidencePolicy'
import type { EvidenceItem } from './EvidenceDrawer'
import type { FormEvent } from 'react'
import type { FunctionReference } from 'convex/server'

type Json = { schemaVersion: 1; value: unknown }
type Detail = {
  request: {
    _id: string
    prompt: string
    title: string
    location?: string
    status: string
    automationPaused: boolean
    version: number
    researchStatus: string
    rankingStatus?: string
    rankingError?: string
    rankingVersion?: number
    candidateCounts: {
      discovered: number
      researching: number
      qualified: number
      rejected: number
      queuedForContact: number
      contacted: number
      responded: number
    }
  }
  requirements: Array<{
    _id: string
    key: string
    label: string
    value: Json
    kind: 'hard_constraint' | 'preference' | 'information'
    source: string
    importance?: number
    confidence: number
  }>
  questions: Array<{
    _id: string
    candidateId?: string
    text: string
    importance: string
    status: string
    answer?: string
  }>
  candidates: Array<{
    _id: string
    name: string
    website: string
    status: string
    qualificationSummary?: string
    rejectionSummary?: string
    shortlistReason?: string
    recommendationStatus?: string
    recommendationScore?: number
    recommendationReason?: string
    recommendationCaveats?: Array<string>
    endpoints: Array<{
      _id: string
      type: string
      value: string
      verificationState: string
      evidenceUrl: string
    }>
    facts: Array<{
      _id: string
      key: string
      label: string
      value: Json
      sourceType: string
      sourceUrl?: string
      excerpt?: string
      confidence: number
      observedAt: number
    }>
  }>
  outreach: Array<{
    _id: string
    candidateId: string
    method: string
    status: string
    contentSummary: string
    safeError?: string
    updatedAt: number
  }>
  conversations: Array<{
    _id: string
    candidateId: string
    status: string
    lastMessageAt?: number
    messages: Array<{
      _id: string
      direction: string
      participants: Array<string>
      subject: string
      sanitizedBody: string
      occurredAt: number
      agentMailMessageId: string
    }>
  }>
}
type Proposal = {
  _id: string
  candidateId: string
  status: string
  summary: string
  confidence: number
  version: number
  attributes: Json
}
const productApi = api as unknown as {
  requestDetails: {
    get: FunctionReference<'query', 'public', { requestId: string }, Detail>
  }
  requirements: {
    upsert: FunctionReference<
      'mutation',
      'public',
      {
        requestId: string
        key: string
        label: string
        value: Json
        kind: 'hard_constraint' | 'preference' | 'information'
        importance?: number
      },
      string
    >
    remove: FunctionReference<
      'mutation',
      'public',
      { requirementId: string },
      null
    >
  }
  questions: {
    answerForRequest: FunctionReference<
      'mutation',
      'public',
      { questionId: string; answer: string },
      null
    >
  }
  requests: {
    pauseAutomation: FunctionReference<
      'mutation',
      'public',
      { requestId: string },
      null
    >
    resumeAutomation: FunctionReference<
      'mutation',
      'public',
      { requestId: string },
      null
    >
    cancel: FunctionReference<'mutation', 'public', { requestId: string }, null>
  }
  outreach: {
    selectCandidates: FunctionReference<'mutation', 'public', { requestId: string; candidateIds: Array<string> }, null>
    retryFailed: FunctionReference<
      'mutation',
      'public',
      { attemptId: string },
      null
    >
  }
  proposals: {
    list: FunctionReference<
      'query',
      'public',
      { requestId: string },
      Array<Proposal>
    >
  }
  diagnostics: {
    getRequest: FunctionReference<
      'query',
      'public',
      { requestId: string },
      {
        requestStatus: string
        candidates: Array<{
          _id: string
          status: string
          qualificationSummary?: string
        }>
        conversations: Array<{
          _id: string
          candidateId: string
          status: string
          lastMessageAt?: number
        }>
        jobs: Array<{
          _id: string
          kind: string
          status: string
          attemptCount: number
          lastErrorCategory?: string
          lastErrorSummary?: string
          updatedAt: number
        }>
        events: Array<{
          eventType: string
          safeMessage: string
          correlationId: string
          createdAt: number
        }>
      }
    >
  }
}

export function RequestDetail({
  requestId,
  onClose,
}: {
  requestId: string
  onClose: () => void
}) {
  const detail = useQuery(productApi.requestDetails.get, { requestId })
  const proposals = useQuery(productApi.proposals.list, { requestId })
  const diagnostics = useQuery(productApi.diagnostics.getRequest, { requestId })
  const pause = useMutation(productApi.requests.pauseAutomation)
  const resume = useMutation(productApi.requests.resumeAutomation)
  const cancel = useMutation(productApi.requests.cancel)
  const retry = useMutation(productApi.outreach.retryFailed)
  const selectCandidates = useMutation(productApi.outreach.selectCandidates)
  const [error, setError] = useState<string | null>(null)
  const [evidence, setEvidence] = useState<EvidenceItem | null>(null)
  if (detail === undefined)
    return (
      <section className="mt-6 rounded-xl border p-5 text-sm">
        Loading request workspace…
      </section>
    )
  const candidateNames = new Map(
    detail.candidates.map((candidate) => [candidate._id, candidate.name]),
  )
  const run = (operation: Promise<unknown>) => {
    setError(null)
    void operation.catch((reason) =>
      setError(
        reason instanceof Error
          ? reason.message.replace(/^\w+:\s*/, '')
          : 'Action could not be completed.',
      ),
    )
  }
  return (
    <section className="mt-6 space-y-6 rounded-xl border border-slate-300 p-5 dark:border-slate-700">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[.16em] text-sky-700">
            REQUEST WORKSPACE
          </p>
          <h2 className="text-2xl font-bold">{detail.request.title}</h2>
          <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
            Original prompt: {detail.request.prompt}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded border px-3 py-1 text-sm"
            onClick={onClose}
            type="button"
          >
            Back to requests
          </button>
          <button
            className="rounded border px-3 py-1 text-sm"
            onClick={() =>
              run(
                detail.request.automationPaused
                  ? resume({ requestId })
                  : pause({ requestId }),
              )
            }
            type="button"
          >
            {detail.request.automationPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            className="rounded border border-red-300 px-3 py-1 text-sm text-red-700"
            onClick={() => run(cancel({ requestId }))}
            type="button"
          >
            Cancel
          </button>
        </div>
      </header>
      {error ? (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>
      ) : null}
      <ResearchSummary detail={detail} />
      <RankedCandidates detail={detail} onError={setError} onEvidence={setEvidence} selectCandidates={selectCandidates} />
      <EvidenceDrawer evidence={evidence} />
      <Requirements detail={detail} onError={setError} />
      <Questions questions={detail.questions} onError={setError} />
      <Candidates candidates={detail.candidates} onEvidence={setEvidence} />
      <Outreach
        attempts={detail.outreach}
        names={candidateNames}
        onRetry={(attemptId) => run(retry({ attemptId }))}
      />
      <Conversations
        conversations={detail.conversations}
        names={candidateNames}
        onEvidence={setEvidence}
      />
      <Proposals
        proposals={proposals}
        names={candidateNames}
        onEvidence={setEvidence}
      />
      <DecisionPanel
        providers={detail.candidates.map((candidate) => ({
          id: candidate._id,
          name: candidate.name,
          factLabels: candidate.facts.map((fact) => fact.label),
        }))}
        requestId={requestId}
        status={detail.request.status}
      />
      <Diagnostics value={diagnostics} />
    </section>
  )
}

function RankedCandidates({ detail, onError, onEvidence, selectCandidates }: { detail: Detail; onError: (value: string | null) => void; onEvidence: (value: EvidenceItem) => void; selectCandidates: (args: { requestId: string; candidateIds: Array<string> }) => Promise<unknown> }) {
  const [selected, setSelected] = useState<Array<string>>([])
  const ranked = detail.candidates.filter(candidate => candidate.recommendationStatus === 'recommended' || candidate.recommendationStatus === 'selected')
  const ranking = detail.request.rankingStatus ?? 'pending'
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 5 ? [...current, id] : current)
  return <section className="rounded-lg border border-sky-200 p-4 dark:border-sky-900">
    <h3 className="font-semibold">Buyer shortlist</h3>
    {ranking === 'pending' || ranking === 'running' ? <p className="mt-1 text-sm text-slate-500">Ranking evidence-bounded candidates… no provider will be contacted yet.</p> : null}
    {ranking === 'retryable_failure' || ranking === 'needs_user' ? <p className="mt-1 text-sm text-amber-700">Ranking needs attention: {detail.request.rankingError ?? 'retry later after ranking is available.'}</p> : null}
    {ranking === 'ready' && !ranked.length ? <p className="mt-1 text-sm text-slate-500">No candidate is currently recommended. Review the retained evidence or continue research.</p> : null}
    {ranked.map(candidate => <label className="mt-3 block rounded border p-3 text-sm" key={candidate._id}><input aria-label={`Select ${candidate.name}`} checked={selected.includes(candidate._id)} disabled={candidate.recommendationStatus === 'selected'} onChange={() => toggle(candidate._id)} type="checkbox" /> <strong className="ml-2">{candidate.name}</strong>{candidate.recommendationStatus === 'selected' ? ' · selected for contact' : ''}{candidate.recommendationScore !== undefined ? ` · ${Math.round(candidate.recommendationScore)}/100` : ''}<p className="mt-1">{candidate.recommendationReason}</p><p className="mt-1 text-xs text-slate-500">Caveats: {candidate.recommendationCaveats?.join(' · ') ?? 'None recorded.'}</p>{candidate.facts[0] ? <button className="mt-2 block text-left text-xs underline" onClick={() => onEvidence({ label: candidate.facts[0].label, sourceType: candidate.facts[0].sourceType, value: candidate.facts[0].value.value, sourceUrl: candidate.facts[0].sourceUrl, excerpt: candidate.facts[0].excerpt, observedAt: candidate.facts[0].observedAt, confidence: candidate.facts[0].confidence })} type="button">View retained website evidence</button> : <p className="mt-2 text-xs text-slate-500">No retained website evidence.</p>}</label>)}
    <p className="mt-3 text-xs text-slate-500" aria-live="polite">{selected.length} of up to 5 recommended providers selected.</p>
    <button className="mt-2 rounded border px-3 py-1 text-sm disabled:opacity-50" disabled={!selected.length || detail.request.automationPaused || ranking !== 'ready'} onClick={() => void selectCandidates({ requestId: detail.request._id, candidateIds: selected }).then(() => setSelected([])).catch(() => onError('Could not queue the selected providers. Refresh the recommendations and inbox status.'))} type="button">Contact selected</button>
  </section>
}

function ResearchSummary({ detail }: { detail: Detail }) {
  const c = detail.request.candidateCounts
  const message =
    detail.request.researchStatus === 'empty'
      ? 'No viable providers yet. Edit the request details or resume automation to recover.'
      : detail.request.automationPaused
        ? 'Automation is paused; inbound messages remain visible.'
        : 'Research and contact progress updates here in realtime.'
  return (
    <section className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
      <h3 className="font-semibold">Live research progress</h3>
      <p className="mt-1 text-sm">
        {c.discovered} discovered · {c.researching} researching · {c.qualified}{' '}
        qualified · {c.rejected} rejected · {c.queuedForContact} queued ·{' '}
        {c.contacted} contacted · {c.responded} responded
      </p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {message}
      </p>
    </section>
  )
}

function Requirements({
  detail,
  onError,
}: {
  detail: Detail
  onError: (value: string | null) => void
}) {
  const upsert = useMutation(productApi.requirements.upsert)
  const remove = useMutation(productApi.requirements.remove)
  const [draft, setDraft] = useState({
    key: '',
    label: '',
    value: '',
    kind: 'preference' as const,
  })
  const grouped = useMemo(
    () =>
      ['hard_constraint', 'preference', 'information'].map((kind) => ({
        kind,
        items: detail.requirements.filter((item) => item.kind === kind),
      })),
    [detail.requirements],
  )
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    let value: unknown = draft.value
    try {
      value = JSON.parse(draft.value)
    } catch {
      /* Plain text is a valid procurement value. */
    }
    onError(null)
    void upsert({
      requestId: detail.request._id,
      key: draft.key
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_'),
      label: draft.label.trim(),
      value: { schemaVersion: 1, value },
      kind: draft.kind,
    })
      .then(() =>
        setDraft({ key: '', label: '', value: '', kind: 'preference' }),
      )
      .catch(() =>
        onError('Requirement could not be saved. Check its key and value.'),
      )
  }
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">Requirements</h3>
      {grouped.map((group) => (
        <div key={group.kind}>
          <h4 className="text-sm font-semibold capitalize">
            {group.kind.replace(/_/g, ' ')}
          </h4>
          {group.items.length ? (
            <ul className="mt-2 space-y-2">
              {group.items.map((item) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm"
                  key={item._id}
                >
                  <span>
                    <strong>{item.label}</strong>: {display(item.value.value)}{' '}
                    <em className="ml-1 text-xs text-slate-500">
                      {item.source} · {Math.round(item.confidence * 100)}%
                    </em>
                  </span>
                  <button
                    className="text-xs underline"
                    onClick={() =>
                      void remove({ requirementId: item._id }).catch(() =>
                        onError('Requirement could not be removed.'),
                      )
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              No {group.kind.replace('_', ' ')} yet.
            </p>
          )}
        </div>
      ))}
      <form
        className="grid gap-2 rounded border p-3 md:grid-cols-4"
        onSubmit={save}
      >
        <input
          aria-label="Requirement key"
          className="rounded border bg-transparent p-2 text-sm"
          onChange={(event) => setDraft({ ...draft, key: event.target.value })}
          placeholder="key"
          required
          value={draft.key}
        />
        <input
          aria-label="Requirement label"
          className="rounded border bg-transparent p-2 text-sm"
          onChange={(event) =>
            setDraft({ ...draft, label: event.target.value })
          }
          placeholder="Label"
          required
          value={draft.label}
        />
        <input
          aria-label="Requirement value"
          className="rounded border bg-transparent p-2 text-sm"
          onChange={(event) =>
            setDraft({ ...draft, value: event.target.value })
          }
          placeholder="Value"
          required
          value={draft.value}
        />
        <div className="flex gap-2">
          <select
            className="rounded border bg-transparent p-2 text-sm"
            onChange={(event) =>
              setDraft({
                ...draft,
                kind: event.target.value as typeof draft.kind,
              })
            }
            value={draft.kind}
          >
            <option value="hard_constraint">Hard</option>
            <option value="preference">Preference</option>
            <option value="information">Info</option>
          </select>
          <button className="rounded border px-3 text-sm" type="submit">
            Add
          </button>
        </div>
      </form>
    </section>
  )
}

function Questions({
  questions,
  onError,
}: {
  questions: Detail['questions']
  onError: (value: string | null) => void
}) {
  const answer = useMutation(productApi.questions.answerForRequest)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const open = questions.filter((question) => question.status === 'open')
  return (
    <section>
      <h3 className="text-lg font-semibold">Needs you</h3>
      {open.length ? (
        <div className="mt-2 space-y-2">
          {open.map((question) => (
            <form
              className="rounded border p-3"
              key={question._id}
              onSubmit={(event) => {
                event.preventDefault()
                void answer({
                  questionId: question._id,
                  answer: answers[question._id] ?? '',
                }).catch(() => onError('Answer could not be saved.'))
              }}
            >
              <p className="text-sm">
                <strong>{question.importance}</strong> — {question.text}
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded border bg-transparent p-2 text-sm"
                  onChange={(event) =>
                    setAnswers({
                      ...answers,
                      [question._id]: event.target.value,
                    })
                  }
                  placeholder="Your factual answer"
                  required
                  value={answers[question._id] ?? ''}
                />
                <button className="rounded border px-3 text-sm" type="submit">
                  Answer
                </button>
              </div>
            </form>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-500">
          No open buyer questions. Independent research can continue.
        </p>
      )}
    </section>
  )
}

function Candidates({
  candidates,
  onEvidence,
}: {
  candidates: Detail['candidates']
  onEvidence: (value: EvidenceItem) => void
}) {
  return (
    <section>
      <h3 className="text-lg font-semibold">Providers and evidence</h3>
      {candidates.length ? (
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {candidates.map((candidate) => (
            <article className="rounded border p-3" key={candidate._id}>
              <div className="flex justify-between gap-2">
                <h4 className="font-semibold">{candidate.name}</h4>
                <span className="text-xs text-slate-500">
                  {candidate.status}
                </span>
              </div>
              <p className="mt-1 text-sm">
                {candidate.qualificationSummary ??
                  candidate.rejectionSummary ??
                  'Evidence is still being gathered.'}
              </p>
              {candidate.shortlistReason ? (
                <p className="mt-1 text-xs text-slate-500">
                  Why chosen: {candidate.shortlistReason}
                </p>
              ) : null}
              {safeEvidenceUrl(candidate.website) ? (
                <a
                  className="mt-2 block text-xs underline"
                  href={safeEvidenceUrl(candidate.website) ?? undefined}
                  rel="noreferrer"
                  target="_blank"
                >
                  Visit public website
                </a>
              ) : null}
              <p className="mt-2 text-xs font-semibold">Contact paths</p>
              <ul className="text-xs">
                {candidate.endpoints.length ? (
                  candidate.endpoints.map((endpoint) => (
                    <li key={endpoint._id}>
                      {endpoint.type}: {endpoint.value}{' '}
                      <span className="text-slate-500">
                        ({endpoint.verificationState})
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">
                    No safe public contact path found.
                  </li>
                )}
              </ul>
              <p className="mt-2 text-xs font-semibold">Website facts</p>
              <div className="space-y-1">
                {candidate.facts.length ? (
                  candidate.facts.map((fact) => (
                    <button
                      className="block text-left text-xs underline"
                      key={fact._id}
                      onClick={() =>
                        onEvidence({
                          label: fact.label,
                          sourceType: fact.sourceType,
                          value: fact.value.value,
                          sourceUrl: fact.sourceUrl,
                          excerpt: fact.excerpt,
                          observedAt: fact.observedAt,
                          confidence: fact.confidence,
                        })
                      }
                      type="button"
                    >
                      {fact.label}: {display(fact.value.value)}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">
                    No retained evidence yet.
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-500">
          No providers have been discovered yet. Progress will appear here
          without refresh.
        </p>
      )}
    </section>
  )
}

function Outreach({
  attempts,
  names,
  onRetry,
}: {
  attempts: Detail['outreach']
  names: Map<string, string>
  onRetry: (id: string) => void
}) {
  return (
    <section>
      <h3 className="text-lg font-semibold">Outreach</h3>
      {attempts.length ? (
        <div className="mt-2 space-y-2">
          {attempts.map((attempt) => (
            <article className="rounded border p-3 text-sm" key={attempt._id}>
              <div className="flex justify-between gap-2">
                <strong>
                  {names.get(attempt.candidateId) ?? 'Provider'} ·{' '}
                  {attempt.method}
                </strong>
                <span>{attempt.status}</span>
              </div>
              <p className="mt-1">{attempt.contentSummary}</p>
              {attempt.safeError ? (
                <p className="mt-1 text-sm text-amber-700">
                  Needs attention: {attempt.safeError}
                </p>
              ) : null}
              {attempt.status === 'retryable_failure' ? (
                <button
                  className="mt-2 rounded border px-2 py-1 text-xs"
                  onClick={() => onRetry(attempt._id)}
                  type="button"
                >
                  Retry safely
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-500">
          No outreach attempt is scheduled. Pausing/cancelling never hides
          existing history.
        </p>
      )}
    </section>
  )
}

function Conversations({
  conversations,
  names,
  onEvidence,
}: {
  conversations: Detail['conversations']
  names: Map<string, string>
  onEvidence: (value: EvidenceItem) => void
}) {
  return (
    <section>
      <h3 className="text-lg font-semibold">Provider conversations</h3>
      {conversations.length ? (
        <div className="mt-2 space-y-3">
          {conversations.map((conversation) => (
            <article className="rounded border p-3" key={conversation._id}>
              <h4 className="font-semibold">
                {names.get(conversation.candidateId) ?? 'Provider'}{' '}
                <span className="text-xs font-normal text-slate-500">
                  · {conversation.status}
                </span>
              </h4>
              {conversation.messages.length ? (
                <ol className="mt-2 space-y-2">
                  {conversation.messages.map((message) => (
                    <li
                      className="rounded bg-slate-50 p-2 text-sm dark:bg-slate-900"
                      key={message._id}
                    >
                      <p className="text-xs font-semibold">
                        {message.direction === 'inbound'
                          ? 'Provider'
                          : 'Compari agent'}{' '}
                        · {message.subject}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {message.sanitizedBody}
                      </p>
                      <button
                        className="mt-1 text-xs underline"
                        onClick={() =>
                          onEvidence({
                            label: message.subject || 'Provider message',
                            sourceType: `routed ${message.direction} message`,
                            value: message.sanitizedBody,
                            observedAt: message.occurredAt,
                          })
                        }
                        type="button"
                      >
                        Inspect message evidence
                      </button>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(message.occurredAt).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  No message body has been routed yet.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-500">
          Conversations will appear after a verified provider reply is routed.
        </p>
      )}
    </section>
  )
}

function Proposals({
  proposals,
  names,
  onEvidence,
}: {
  proposals: Array<Proposal> | undefined
  names: Map<string, string>
  onEvidence: (value: EvidenceItem) => void
}) {
  return (
    <section>
      <h3 className="text-lg font-semibold">Proposals</h3>
      {proposals === undefined ? (
        <p className="text-sm text-slate-500">Loading offers…</p>
      ) : proposals.length ? (
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {proposals.map((proposal) => (
            <article className="rounded border p-3" key={proposal._id}>
              <h4 className="font-semibold">
                {names.get(proposal.candidateId) ?? 'Provider'} ·{' '}
                {proposal.status}
              </h4>
              <p className="mt-1 text-sm">{proposal.summary}</p>
              <p className="mt-1 text-xs text-slate-500">
                v{proposal.version} · {Math.round(proposal.confidence * 100)}%
                confidence
              </p>
              <button
                className="mt-2 text-xs underline"
                onClick={() =>
                  onEvidence({
                    label: 'Proposal attributes',
                    sourceType: 'normalized proposal',
                    value: proposal.attributes.value,
                    confidence: proposal.confidence,
                  })
                }
                type="button"
              >
                Inspect normalized attributes
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-slate-500">
          Partial or complete offers will appear after provider replies are
          processed.
        </p>
      )}
    </section>
  )
}

function Diagnostics({
  value,
}: {
  value: ReturnType<typeof useQuery> | undefined
}) {
  const data = value as
    | {
        jobs?: Array<{
          _id: string
          kind: string
          status: string
          attemptCount: number
          lastErrorCategory?: string
          lastErrorSummary?: string
        }>
        events?: Array<{
          eventType: string
          safeMessage: string
          correlationId: string
          createdAt: number
        }>
      }
    | undefined
  return (
    <details className="rounded border p-3 text-sm">
      <summary className="cursor-pointer font-semibold">
        Operational diagnostics
      </summary>
      {data ? (
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold">Jobs</h4>
            <ul>
              {data.jobs?.map((job) => (
                <li className="mt-1 text-xs" key={job._id}>
                  {job.kind}: {job.status} ({job.attemptCount})
                  {job.lastErrorSummary ? ` — ${job.lastErrorSummary}` : ''}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold">Activity</h4>
            <ul>
              {data.events?.map((event) => (
                <li
                  className="mt-1 text-xs"
                  key={`${event.correlationId}-${event.createdAt}`}
                >
                  {event.eventType}: {event.safeMessage}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs">Loading safe operational state…</p>
      )}
    </details>
  )
}
function display(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}
