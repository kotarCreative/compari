import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { productApi } from '../request/contracts'
import { pendingFirstRequestIdKey, pendingFirstRequestKey } from './constants'
import { requestsApi } from './contracts'
import { RequestConversation } from './RequestConversation'
import { RequestChatLayout } from './RequestChatLayout'
import { Button } from '~/components/ui'
import { errorMessage } from '~/lib/errors'
import { readSession, removeSession, writeSession } from '~/lib/storage'

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
    readSession(pendingFirstRequestIdKey),
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
  const [retryNonce, setRetryNonce] = useState(0)
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
    removeSession(pendingFirstRequestIdKey)
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
        writeSession(pendingFirstRequestIdKey, createdRequestId)
        setPendingRequestId(createdRequestId)
      })
      .catch((reason) => {
        setError(errorMessage(reason, 'Unable to create your first request.'))
        // Keep isCreating.current = true so incidental re-renders or
        // dependency changes cannot trigger a silent auto-retry loop.
        // Only the manual retry button below may reset it.
      })
  }, [create, retryNonce, location, pendingRequestId, prompt])

  useEffect(() => {
    setAnswerDraft('')
  }, [firstOpenQuestion?._id])

  const loaderPhase =
    !detail || detail.request.interpretedVersion !== detail.request.version
      ? 'interpreting'
      : !firstOpenQuestion
        ? 'vendors'
        : undefined

  const resultsReady = Boolean(
    detail &&
    !firstOpenQuestion &&
    detail.request.interpretedVersion === detail.request.version &&
    ['complete', 'empty'].includes(detail.request.researchStatus),
  )

  return (
    <RequestChatLayout>
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
        loaderPhase={resultsReady ? undefined : loaderPhase}
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
      {resultsReady && detail ? (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <p className="text-sm" role="status">
            {detail.request.researchStatus === 'empty'
              ? 'Research is finished, but we haven’t found suitable options yet.'
              : 'Your options are ready to review.'}
          </p>
          <Button
            onClick={() => {
              removeSession(pendingFirstRequestKey)
              removeSession(pendingFirstRequestIdKey)
              onComplete(detail.request._id)
            }}
          >
            View results
          </Button>
        </div>
      ) : null}
      {error && !requestId ? (
        <Button
          className="mx-auto mt-4"
          onClick={() => {
            isCreating.current = false
            setError(null)
            setRetryNonce((nonce) => nonce + 1)
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
    </RequestChatLayout>
  )
}
