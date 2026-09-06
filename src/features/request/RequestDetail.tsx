import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { DecisionPanel } from '../decision/DecisionPanel'
import { RequestConversation } from '../workspace/RequestConversation'
import { productApi } from './contracts'
import type { RequestDetailValue as Detail } from './contracts'
import { errorMessage } from '~/lib/errors'
import { Alert, Button } from '~/components/ui'

export function RequestDetail({
  requestId,
  requestPrompt,
  onClose,
}: {
  requestId: string
  requestPrompt: string
  onClose: () => void
}) {
  const detail = useQuery(productApi.requestDetails.get, { requestId })
  const pause = useMutation(productApi.requests.pauseAutomation)
  const resume = useMutation(productApi.requests.resumeAutomation)
  const cancel = useMutation(productApi.requests.cancel)
  const retryFailed = useMutation(productApi.outreach.retryFailed)
  const answerQuestion = useMutation(productApi.questions.answerForRequest)
  const selectCandidates = useMutation(productApi.outreach.selectCandidates)
  const [answerDraft, setAnswerDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isAnswering, setIsAnswering] = useState(false)
  const firstOpenQuestion = detail?.questions.find(
    (question) => question.status === 'open',
  )

  useEffect(() => setAnswerDraft(''), [firstOpenQuestion?._id])

  if (detail === undefined)
    return (
      <section className="mt-8 border-t border-slate-200 pt-8 dark:border-slate-800">
        <RequestConversation
          loaderPhase="interpreting"
          prompt={requestPrompt}
        />
      </section>
    )

  const hasAnsweredQuestion = detail.questions.some((question) =>
    Boolean(question.answer),
  )
  const isIntakeVisible =
    Boolean(firstOpenQuestion) ||
    (detail.request.status === 'draft' && !hasAnsweredQuestion)
  const run = (operation: Promise<unknown>) => {
    setError(null)
    void operation.catch((reason) => setError(errorMessage(reason)))
  }

  return (
    <section className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[.16em] text-sky-700 dark:text-sky-300">
            ACTIVE COMPARISON
          </p>
          <h2 className="mt-1 text-2xl font-bold">{detail.request.title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onClose} size="sm" variant="outline">
            All requests
          </Button>
          <Button
            onClick={() =>
              run(
                detail.request.automationPaused
                  ? resume({ requestId })
                  : pause({ requestId }),
              )
            }
            size="sm"
            variant="outline"
          >
            {detail.request.automationPaused ? 'Resume agents' : 'Pause agents'}
          </Button>
          <Button
            onClick={() => run(cancel({ requestId }))}
            size="sm"
            variant="ghost"
          >
            Cancel
          </Button>
        </div>
      </header>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {isIntakeVisible ? (
        <RequestConversation
          answer={answerDraft}
          history={detail.questions.flatMap((question) =>
            question.answer
              ? [
                  {
                    id: question._id,
                    text: question.text,
                    importance: question.importance,
                    answer: question.answer,
                  },
                ]
              : [],
          )}
          isAnswering={isAnswering}
          loaderPhase={
            detail.request.status === 'draft' ? 'interpreting' : undefined
          }
          onAnswerChange={setAnswerDraft}
          onAnswerSubmit={(event) => {
            event.preventDefault()
            if (!firstOpenQuestion) return
            setError(null)
            setIsAnswering(true)
            void answerQuestion({
              questionId: firstOpenQuestion._id,
              answer: answerDraft,
            })
              .then(() => setAnswerDraft(''))
              .catch((reason) =>
                setError(errorMessage(reason, 'Answer could not be saved.')),
              )
              .finally(() => setIsAnswering(false))
          }}
          prompt={detail.request.prompt}
          question={firstOpenQuestion}
        />
      ) : (
        <div className="space-y-6">
          <AgentProgress detail={detail} />
          <Options
            detail={detail}
            onError={setError}
            retryFailed={retryFailed}
            selectCandidates={selectCandidates}
          />
          <DecisionPanel
            providers={detail.candidates.map((candidate) => ({
              id: candidate._id,
              name: candidate.name,
              factLabels: candidate.facts.map((fact) => fact.label),
            }))}
            requestId={detail.request._id}
            status={detail.request.status}
          />
        </div>
      )}
    </section>
  )
}

function AgentProgress({ detail }: { detail: Detail }) {
  const order = [
    'draft',
    'researching',
    'contacting',
    'collecting_responses',
    'evaluating',
    'awaiting_selection',
    'completed',
  ]
  const current = Math.max(order.indexOf(detail.request.status), 0)
  const agents = [
    {
      name: 'Research agent',
      detail: `${detail.request.candidateCounts.discovered} options found`,
      startsAt: 1,
      endsAt: 1,
    },
    {
      name: 'Outreach agent',
      detail: `${detail.request.candidateCounts.contacted} contacted · ${detail.request.candidateCounts.responded} replied`,
      startsAt: 2,
      endsAt: 3,
    },
    {
      name: 'Comparison agent',
      detail:
        detail.request.status === 'awaiting_selection'
          ? 'Ready for your choice'
          : 'Preparing your options',
      startsAt: 4,
      endsAt: 4,
    },
  ]

  return (
    <section aria-labelledby="agent-progress-heading">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold" id="agent-progress-heading">
          Agent progress
        </h3>
        {detail.request.automationPaused ? (
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            Paused
          </span>
        ) : null}
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-3">
        {agents.map((agent) => {
          const state =
            current < agent.startsAt
              ? 'Waiting'
              : current <= agent.endsAt
                ? 'Working'
                : 'Done'
          return (
            <li
              className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-900"
              key={agent.name}
            >
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  state === 'Working'
                    ? 'animate-pulse bg-sky-500'
                    : state === 'Done'
                      ? 'bg-emerald-500'
                      : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">{agent.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {state} · {agent.detail}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Options({
  detail,
  onError,
  retryFailed,
  selectCandidates,
}: {
  detail: Detail
  onError: (value: string | null) => void
  retryFailed: (args: { attemptId: string }) => Promise<unknown>
  selectCandidates: (args: {
    requestId: string
    candidateIds: Array<string>
  }) => Promise<unknown>
}) {
  const [selected, setSelected] = useState<Array<string>>([])
  const [isContacting, setIsContacting] = useState(false)
  const [retryingAttemptId, setRetryingAttemptId] = useState<string | null>(
    null,
  )
  const options = detail.candidates.filter(
    (candidate) =>
      candidate.recommendationStatus === 'recommended' ||
      candidate.recommendationStatus === 'selected',
  )
  const rankingReady = detail.request.rankingStatus === 'ready'
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < 5
          ? [...current, id]
          : current,
    )

  return (
    <section aria-labelledby="options-heading">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold" id="options-heading">
            Your options
          </h3>
          <p className="text-sm text-slate-500">
            Choose who you want the agents to contact.
          </p>
        </div>
        {options.length ? (
          <span className="text-xs text-slate-500">{options.length} ready</span>
        ) : null}
      </div>

      {options.length ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {options.map((candidate) => {
            const selectedForContact =
              candidate.recommendationStatus === 'selected'
            const hasEmail = candidate.endpoints.some(
              (endpoint) =>
                endpoint.type === 'email' &&
                (endpoint.verificationState === 'public' ||
                  endpoint.verificationState === 'verified'),
            )
            const checked = selected.includes(candidate._id)
            return (
              <label
                className={`cursor-pointer rounded-xl border p-4 transition ${
                  checked
                    ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500 dark:bg-sky-950/40'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
                }`}
                key={candidate._id}
              >
                <div className="flex items-start gap-3">
                  <input
                    aria-label={`Select ${candidate.name}`}
                    checked={checked || selectedForContact}
                    className="mt-1"
                    disabled={selectedForContact || !hasEmail || isContacting}
                    onChange={() => toggle(candidate._id)}
                    type="checkbox"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <strong>{candidate.name}</strong>
                      {candidate.recommendationScore !== undefined ? (
                        <span className="shrink-0 text-sm font-semibold text-sky-700 dark:text-sky-300">
                          {Math.round(candidate.recommendationScore)}/100
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {candidate.recommendationReason ??
                        'This option matches your request.'}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {selectedForContact
                        ? 'Contact in progress'
                        : hasEmail
                          ? 'Ready to contact'
                          : 'Waiting for a contact method'}
                    </p>
                  </div>
                </div>
              </label>
            )
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
          <p className="font-medium">
            {rankingReady
              ? 'No suitable options yet'
              : 'Options are on the way'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            The agent progress above updates automatically.
          </p>
        </div>
      )}

      {options.length ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {selected.length} selected · up to 5
          </p>
          <Button
            disabled={
              !selected.length ||
              detail.request.automationPaused ||
              !rankingReady ||
              isContacting
            }
            onClick={() => {
              onError(null)
              setIsContacting(true)
              void selectCandidates({
                requestId: detail.request._id,
                candidateIds: selected,
              })
                .then(() => setSelected([]))
                .catch((reason) =>
                  onError(
                    errorMessage(reason, 'Could not contact these options.'),
                  ),
                )
                .finally(() => setIsContacting(false))
            }}
            size="sm"
          >
            {isContacting ? 'Starting contact…' : 'Contact selected'}
          </Button>
        </div>
      ) : null}

      {detail.outreach.length ? (
        <div className="mt-4 space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h4 className="text-sm font-semibold">Outreach status</h4>
          {detail.outreach.map((attempt) => {
            const candidate = detail.candidates.find(
              (item) => item._id === attempt.candidateId,
            )
            const isRetryable =
              attempt.status === 'retryable_failure' ||
              (attempt.status === 'needs_user' &&
                attempt.safeError?.includes('Idempotency-Key') === true &&
                attempt.safeError.includes('invalid_format'))
            return (
              <div
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
                key={attempt._id}
              >
                <div>
                  <p className="font-medium">
                    {candidate?.name ?? 'Provider'} · {attempt.status}
                  </p>
                  {attempt.safeError ? (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {attempt.safeError}
                    </p>
                  ) : null}
                </div>
                {isRetryable ? (
                  <Button
                    disabled={retryingAttemptId === attempt._id}
                    onClick={() => {
                      onError(null)
                      setRetryingAttemptId(attempt._id)
                      void retryFailed({ attemptId: attempt._id })
                        .catch((reason) =>
                          onError(
                            errorMessage(reason, 'Could not retry outreach.'),
                          ),
                        )
                        .finally(() => setRetryingAttemptId(null))
                    }}
                    size="sm"
                    variant="outline"
                  >
                    {retryingAttemptId === attempt._id
                      ? 'Retrying…'
                      : 'Retry contact'}
                  </Button>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
