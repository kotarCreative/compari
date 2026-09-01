import { useAuthActions } from '@convex-dev/auth/react'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { DecisionPanel } from '../decision/DecisionPanel'
import { DemoModeBanner } from '../decision/DemoModeBanner'
import { RequestDetail } from '../request/RequestDetail'
import { pendingFirstRequestKey, requestPromptPlaceholder } from './constants'
import { requestsApi, usersApi } from './contracts'
import type { Profile } from './contracts'
import type { FormEvent } from 'react'
import { errorMessage } from '~/lib/errors'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Textarea,
} from '~/components/ui'
import { StatusBadge } from '~/components/common/StatusBadge'

export function WorkspaceShell({ profile }: { profile: Profile }) {
  const { signOut } = useAuthActions()
  const retryInbox = useMutation(usersApi.users.retryMyInboxProvisioning)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [isRetryingInbox, setIsRetryingInbox] = useState(false)
  const status = profile.inboxProvisioningStatus ?? 'pending'
  const inboxDetail =
    status === 'ready'
      ? profile.agentEmailAddress
      : status === 'permanent_failure'
        ? 'Inbox setup failed and can be retried.'
        : status === 'retryable_failure'
          ? 'Inbox setup can be retried.'
          : 'Creating your dedicated buyer inbox…'

  return (
    <main className="mx-auto min-h-screen max-w-4xl p-8">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
        <div>
          <p className="text-sm font-semibold tracking-[0.22em] text-sky-600">
            COMPARI
          </p>
          <h1 className="mt-2 text-3xl font-bold">Your buyer workspace</h1>
        </div>
        <Button onClick={() => void signOut()} variant="outline">
          Sign out
        </Button>
      </header>
      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 dark:text-slate-300">
              {profile.name ?? profile.email ?? 'Private device workspace'}
            </p>
            {profile.email ? (
              <p className="text-sm text-slate-500">{profile.email}</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Buyer inbox</CardTitle>
            <StatusBadge status={status} />
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 dark:text-slate-300">{inboxDetail}</p>
            {profile.inboxProvisioningError ? (
              <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {profile.inboxProvisioningError}
              </p>
            ) : null}
            {status === 'retryable_failure' ||
            status === 'permanent_failure' ? (
              <Button
                className="mt-3"
                disabled={isRetryingInbox}
                onClick={() => {
                  setRetryError(null)
                  setIsRetryingInbox(true)
                  void retryInbox({})
                    .catch(() =>
                      setRetryError(
                        'Inbox retry failed. Please try again shortly.',
                      ),
                    )
                    .finally(() => setIsRetryingInbox(false))
                }}
                variant="outline"
              >
                {isRetryingInbox
                  ? 'Retrying inbox setup…'
                  : 'Retry inbox setup'}
              </Button>
            ) : null}
            {retryError ? (
              <p className="mt-2 text-sm text-red-600">{retryError}</p>
            ) : null}
          </CardContent>
        </Card>
      </section>
      <DemoModeBanner />
      <RequestWorkspace />
    </main>
  )
}

function RequestWorkspace() {
  const create = useMutation(requestsApi.requests.create)
  const pause = useMutation(requestsApi.requests.pauseAutomation)
  const resume = useMutation(requestsApi.requests.resumeAutomation)
  const requests = useQuery(requestsApi.requests.list, {
    paginationOpts: { numItems: 20, cursor: null },
  })
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(
    null,
  )
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  )

  useEffect(() => {
    const pendingPrompt = window.sessionStorage.getItem(pendingFirstRequestKey)
    if (!pendingPrompt) return
    window.sessionStorage.removeItem(pendingFirstRequestKey)
    setPrompt(pendingPrompt)
    setIsCreating(true)
    void create({ prompt: pendingPrompt })
      .then((requestId) => {
        setPrompt('')
        setSelectedRequestId(requestId)
      })
      .catch((reason) =>
        setError(errorMessage(reason, 'Unable to create request.')),
      )
      .finally(() => setIsCreating(false))
  }, [create])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsCreating(true)
    try {
      const requestId = await create({ prompt })
      setPrompt('')
      setSelectedRequestId(requestId)
    } catch (reason) {
      setError(errorMessage(reason, 'Unable to create request.'))
    } finally {
      setIsCreating(false)
    }
  }

  if (selectedRequestId)
    return (
      <RequestDetail
        onClose={() => setSelectedRequestId(null)}
        requestId={selectedRequestId}
      />
    )

  return (
    <section className="mt-8 space-y-5 border-t border-slate-200 pt-8 dark:border-slate-800">
      <div>
        <h2 className="text-xl font-bold">Start a comparison</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Describe the outcome. Compari will interpret editable requirements and
          only research within this request’s scope.
        </p>
      </div>
      <form className="space-y-3" onSubmit={(event) => void submit(event)}>
        <Label htmlFor="request-prompt">What are you looking for?</Label>
        <Textarea
          className="min-h-28"
          id="request-prompt"
          minLength={12}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={requestPromptPlaceholder}
          required
          value={prompt}
        />
        <Button
          disabled={isCreating || prompt.trim().length < 12}
          type="submit"
        >
          {isCreating ? 'Starting comparison…' : 'Start comparison'}
        </Button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
      <div className="space-y-3">
        <h3 className="font-semibold">Your requests</h3>
        {requests === undefined ? (
          <p className="text-sm text-slate-500">Loading requests…</p>
        ) : requests.page.length === 0 ? (
          <p className="text-sm text-slate-500">
            Your requests will appear here.
          </p>
        ) : (
          requests.page.map((request) => (
            <Card className="transition hover:border-sky-300" key={request._id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle>{request.title}</CardTitle>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {request.prompt}
                  </p>
                </div>
                <StatusBadge status={request.status} />
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ['Discovered', request.candidateCounts.discovered],
                    ['Qualified', request.candidateCounts.qualified],
                    ['Rejected', request.candidateCounts.rejected],
                  ].map(([label, value]) => (
                    <div
                      className="rounded-lg bg-slate-50 px-2 py-3 dark:bg-slate-900"
                      key={label}
                    >
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="mt-1 text-lg font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    disabled={updatingRequestId === request._id}
                    onClick={() => {
                      setError(null)
                      setUpdatingRequestId(request._id)
                      void (
                        request.automationPaused
                          ? resume({ requestId: request._id })
                          : pause({ requestId: request._id })
                      )
                        .catch((reason) =>
                          setError(
                            errorMessage(
                              reason,
                              'Automation status could not be updated.',
                            ),
                          ),
                        )
                        .finally(() => setUpdatingRequestId(null))
                    }}
                    size="sm"
                    variant="outline"
                  >
                    {updatingRequestId === request._id
                      ? 'Updating…'
                      : request.automationPaused
                        ? 'Resume research'
                        : 'Pause automation'}
                  </Button>
                  <Button
                    onClick={() => setSelectedRequestId(request._id)}
                    size="sm"
                  >
                    Open workspace
                  </Button>
                </div>
                <DecisionPanel
                  requestId={request._id}
                  status={request.status}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  )
}
