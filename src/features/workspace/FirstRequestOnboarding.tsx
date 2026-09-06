import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { productApi } from '../request/contracts'
import { pendingFirstRequestIdKey, pendingFirstRequestKey } from './constants'
import { requestsApi } from './contracts'
import { RequestConversation } from './RequestConversation'
import { Button } from '~/components/ui'
import { errorMessage } from '~/lib/errors'

export function FirstRequestOnboarding({
  prompt,
  onComplete,
  location,
}: {
  prompt: string
  onComplete: (requestId: string) => void
  location?: string
}) {
  const create = useMutation(requestsApi.requests.create)
  const answerQuestion = useMutation(productApi.questions.answerForRequest)
  const retryIntake = useMutation(productApi.requests.retryIntake)
  const retryDiscovery = useMutation(productApi.requests.retryDiscovery)
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(() =>
    window.sessionStorage.getItem(pendingFirstRequestIdKey),
  )
  const resolvedPendingRequestId = useQuery(
    requestsApi.requests.resolvePending,
    pendingRequestId ? { requestId: pendingRequestId } : 'skip',
  )
  const requestId = resolvedPendingRequestId ?? null
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
  const [isRetryingDiscovery, setIsRetryingDiscovery] = useState(false)
  const [createAttempt, setCreateAttempt] = useState(0)
  const isCreating = useRef(false)
  const firstOpenQuestion = detail?.questions.find(
    (question) => question.status === 'open',
  )
  const failedIntake = diagnostics?.jobs.find(
    (job) =>
      job.kind === 'extract_requirements' &&
      (job.status === 'permanent_failure' || job.status === 'needs_user'),
  )
  const failedDiscovery = diagnostics?.jobs.find(
    (job) =>
      job.kind === 'discover_providers' &&
      (job.status === 'permanent_failure' || job.status === 'needs_user'),
  )

  useEffect(() => {
    if (!pendingRequestId || resolvedPendingRequestId !== null) return
    window.sessionStorage.removeItem(pendingFirstRequestIdKey)
    setPendingRequestId(null)
  }, [pendingRequestId, resolvedPendingRequestId])

  useEffect(() => {
    if (pendingRequestId || isCreating.current) return
    isCreating.current = true
    setError(null)
    void create({
      prompt,
      ...(location ? { location } : {}),
    })
      .then((createdRequestId) => {
        window.sessionStorage.setItem(
          pendingFirstRequestIdKey,
          createdRequestId,
        )
        setPendingRequestId(createdRequestId)
      })
      .catch((reason) => {
        setError(errorMessage(reason, 'Unable to create your first request.'))
        isCreating.current = false
      })
  }, [create, createAttempt, location, pendingRequestId, prompt])

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
          (failedIntake
            ? 'Compari could not interpret this request.'
            : (failedDiscovery?.lastErrorSummary ??
              (failedDiscovery
                ? 'Compari could not research providers for this request.'
                : null)))
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
        canEditLocation
        location={location}
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
      {failedDiscovery && requestId ? (
        <Button
          className="mx-auto mt-4 flex"
          disabled={isRetryingDiscovery}
          onClick={() => {
            setError(null)
            setIsRetryingDiscovery(true)
            void retryDiscovery({ requestId })
              .catch((reason) =>
                setError(
                  errorMessage(
                    reason,
                    'Provider research could not be retried.',
                  ),
                ),
              )
              .finally(() => setIsRetryingDiscovery(false))
          }}
          variant="outline"
        >
          {isRetryingDiscovery ? 'Retrying research…' : 'Retry research'}
        </Button>
      ) : null}
    </main>
  )
}
