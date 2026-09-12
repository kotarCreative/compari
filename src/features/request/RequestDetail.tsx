import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { DecisionPanel } from '../decision/DecisionPanel'
import { RequestConversation } from '../workspace/RequestConversation'
import { productApi } from './contracts'
import { AgentProgress } from './components/AgentProgress'
import { errorMessage } from '~/lib/errors'
import { Alert, Button } from '~/components/ui'
import { DetailDialog } from '~/components/common/DetailDialog'

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
    <section className="mt-8 space-y-6 py-4">
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
            <DetailDialog label="Original conversation">
              <RequestConversation
                prompt={detail.request.prompt}
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
              />
            </DetailDialog>
            <DetailDialog label="Request controls">
              {error ? <Alert variant="destructive">{error}</Alert> : null}
              {!['completed', 'cancelled'].includes(detail.request.status) ? (
                <div className="flex gap-3">
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
                    Cancel comparison
                  </Button>
                </div>
              ) : null}
            </DetailDialog>
          </div>
        </div>
        <AgentProgress detail={detail} />
      </header>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {isIntakeVisible ? (
        <div>
          <RequestConversation
            showHistory={false}
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
        </div>
      ) : null}
      {detail.request.status !== 'draft' ? (
        <div className="space-y-6">
          <DecisionPanel
            detail={detail}
            onError={setError}
            retryFailed={retryFailed}
            selectCandidates={selectCandidates}
          />
        </div>
      ) : null}
    </section>
  )
}
