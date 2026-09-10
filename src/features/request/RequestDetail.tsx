import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { DecisionPanel } from '../decision/DecisionPanel'
import { RequestConversation } from '../workspace/RequestConversation'
import { productApi } from './contracts'
import { AgentProgress } from './components/AgentProgress'
import { OutreachStatus } from './components/OutreachStatus'
import { displayEvidenceValue, safeEvidenceUrl } from './evidencePolicy'
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
      <section className="mt-8 pt-8 dark:border-slate-800">
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
    <section className="mt-8 space-y-12 py-4">
      <header className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
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
              {detail.request.automationPaused
                ? 'Resume agents'
                : 'Pause agents'}
            </Button>
            <Button
              onClick={() => run(cancel({ requestId }))}
              size="sm"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        </div>
        <AgentProgress detail={detail} />
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
  const options = detail.candidates.filter(
    (candidate) =>
      candidate.recommendationStatus === 'recommended' ||
      candidate.recommendationStatus === 'selected',
  )
  const rankingReady = detail.request.rankingStatus === 'ready'
  const canFollowUp = ['researching', 'awaiting_selection'].includes(
    detail.request.status,
  )
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
            Published website prices are shown first. Follow up only when you
            want missing details confirmed.
          </p>
        </div>
        {options.length ? (
          <span className="text-xs text-slate-500">{options.length} ready</span>
        ) : null}
      </div>

      {options.length ? (
        <div className="mt-5 grid gap-4">
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
            const websiteUrl = safeEvidenceUrl(candidate.website)
            const websitePrice = candidate.facts.find(
              (fact) => fact.key === 'price' && fact.sourceType === 'website',
            )
            return (
              <div
                className={`option-row cursor-pointer px-4 py-5 transition-colors ${
                  checked || selectedForContact
                    ? 'bg-sky-100/40'
                    : 'hover:bg-slate-100/40'
                }`}
                key={candidate._id}
              >
                <label
                  className="flex items-start gap-3"
                  htmlFor={`candidate-${candidate._id}`}
                >
                  <input
                    aria-label={`Select ${candidate.name}`}
                    checked={checked || selectedForContact}
                    className="ink-checkbox mt-1"
                    disabled={selectedForContact || !hasEmail || isContacting}
                    id={`candidate-${candidate._id}`}
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
                        ? 'Follow-up in progress'
                        : websitePrice
                          ? `Website price: ${displayEvidenceValue(websitePrice.value.value)}`
                          : hasEmail
                            ? 'No public price found · follow-up available'
                            : 'No public price or email follow-up found'}
                    </p>
                  </div>
                </label>
                {websiteUrl ? (
                  <p className="mt-3 pl-8 text-xs">
                    <a
                      className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
                      href={websiteUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Verify on original website{' '}
                      <span aria-hidden="true">↗</span>
                    </a>
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-3 py-8 text-center">
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
              !canFollowUp ||
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
            {isContacting ? 'Starting follow-up…' : 'Follow up with selected'}
          </Button>
        </div>
      ) : null}

      <OutreachStatus
        detail={detail}
        onError={onError}
        retryFailed={retryFailed}
      />
    </section>
  )
}
