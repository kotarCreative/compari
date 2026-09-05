import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { productApi } from '../request/contracts'
import {
  pendingFirstAskForLocationKey,
  pendingFirstLocationKey,
  pendingFirstRequestIdKey,
  pendingFirstRequestKey,
} from './constants'
import { requestsApi } from './contracts'
import { RequestConversation } from './RequestConversation'
import { Button } from '~/components/ui'
import { errorMessage } from '~/lib/errors'

export function FirstRequestOnboarding({
  prompt,
  onComplete,
}: {
  prompt: string
  onComplete: (requestId: string) => void
}) {
  const create = useMutation(requestsApi.requests.create)
  const answerQuestion = useMutation(productApi.questions.answerForRequest)
  const retryIntake = useMutation(productApi.requests.retryIntake)
  const [requestId, setRequestId] = useState<string | null>(() =>
    window.sessionStorage.getItem(pendingFirstRequestIdKey),
  )
  const detail = useQuery(
    productApi.requestDetails.get,
    requestId ? { requestId } : 'skip',
  )
  const diagnostics = useQuery(
    productApi.diagnostics.getRequest,
    requestId ? { requestId } : 'skip',
  )
  const [answerDraft, setAnswerDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isAnswering, setIsAnswering] = useState(false)
  const [isRetryingIntake, setIsRetryingIntake] = useState(false)
  const [createAttempt, setCreateAttempt] = useState(0)
  const [requestLocation] = useState(() => ({
    location:
      window.sessionStorage.getItem(pendingFirstLocationKey) ?? undefined,
    askForLocation:
      window.sessionStorage.getItem(pendingFirstAskForLocationKey) === 'true',
  }))
  const isCreating = useRef(false)
  const firstOpenQuestion = detail?.questions.find(
    (question) => question.status === 'open',
  )
  const failedIntake = diagnostics?.jobs.find(
    (job) =>
      job.kind === 'extract_requirements' &&
      (job.status === 'permanent_failure' || job.status === 'needs_user'),
  )

  useEffect(() => {
    if (requestId || isCreating.current) return
    isCreating.current = true
    setError(null)
    void create({ prompt, ...requestLocation })
      .then((createdRequestId) => {
        window.sessionStorage.setItem(
          pendingFirstRequestIdKey,
          createdRequestId,
        )
        setRequestId(createdRequestId)
      })
      .catch((reason) => {
        setError(errorMessage(reason, 'Unable to create your first request.'))
        isCreating.current = false
      })
  }, [create, createAttempt, prompt, requestId, requestLocation])

  useEffect(() => {
    setAnswerDraft('')
  }, [firstOpenQuestion?._id])

  const loaderPhase =
    !detail || detail.request.interpretedVersion !== detail.request.version
      ? 'interpreting'
      : !firstOpenQuestion
        ? 'vendors'
        : undefined

  useEffect(() => {
    if (
      !detail ||
      firstOpenQuestion ||
      detail.request.interpretedVersion !== detail.request.version ||
      (detail.request.researchStatus !== 'complete' &&
        detail.request.researchStatus !== 'empty')
    )
      return
    const timeout = window.setTimeout(() => {
      window.sessionStorage.removeItem(pendingFirstRequestKey)
      window.sessionStorage.removeItem(pendingFirstRequestIdKey)
      window.sessionStorage.removeItem(pendingFirstLocationKey)
      window.sessionStorage.removeItem(pendingFirstAskForLocationKey)
      onComplete(detail.request._id)
    }, 2_000)
    return () => window.clearTimeout(timeout)
  }, [detail, firstOpenQuestion, onComplete])

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-8 py-12 md:py-20">
      <p className="mb-10 text-sm font-semibold tracking-[0.22em] text-sky-600">
        COMPARI
      </p>
      <RequestConversation
        answer={answerDraft}
        error={
          error ??
          failedIntake?.lastErrorSummary ??
          (failedIntake ? 'Compari could not interpret this request.' : null)
        }
        history={
          detail?.questions.flatMap((question) =>
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
          ) ?? []
        }
        isAnswering={isAnswering}
        loaderPhase={loaderPhase}
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
        prompt={detail?.request.prompt ?? prompt}
        question={firstOpenQuestion}
      />
      {error && !requestId ? (
        <Button
          className="mx-auto mt-4"
          onClick={() => {
            isCreating.current = false
            setError(null)
            setCreateAttempt((attempt) => attempt + 1)
          }}
          variant="outline"
        >
          Retry request
        </Button>
      ) : null}
      {failedIntake && requestId ? (
        <Button
          className="mx-auto mt-4 flex"
          disabled={isRetryingIntake}
          onClick={() => {
            setError(null)
            setIsRetryingIntake(true)
            void retryIntake({ requestId })
              .catch((reason) =>
                setError(
                  errorMessage(
                    reason,
                    'Request interpretation could not be retried.',
                  ),
                ),
              )
              .finally(() => setIsRetryingIntake(false))
          }}
          variant="outline"
        >
          {isRetryingIntake
            ? 'Retrying interpretation…'
            : 'Retry interpretation'}
        </Button>
      ) : null}
    </main>
  )
}
