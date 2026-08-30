import { createFileRoute } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'
import { DecisionPanel } from '../features/decision/DecisionPanel'
import { DemoModeBanner } from '../features/decision/DemoModeBanner'
import { RequestDetail } from '../features/request/RequestDetail'
import type { FunctionReference } from 'convex/server'
import type { FormEvent } from 'react'

type Profile = {
  name?: string
  email?: string
  agentEmailAddress?: string
  inboxProvisioningStatus?:
    | 'pending'
    | 'provisioning'
    | 'ready'
    | 'retryable_failure'
    | 'permanent_failure'
}
type NoArgs = Record<string, never>
const pendingFirstRequestKey = 'compari.pending-first-request'
type RequestList = {
  page: Array<{
    _id: string
    title: string
    prompt: string
    status: string
    researchStatus: string
    automationPaused: boolean
    candidateCounts: { discovered: number; qualified: number; rejected: number }
  }>
  continueCursor: string
  isDone: boolean
}
const usersApi = api as unknown as {
  users: {
    ensureCurrentUser: FunctionReference<'mutation', 'public', NoArgs, string>
    current: FunctionReference<'query', 'public', NoArgs, Profile | null>
    retryMyInboxProvisioning: FunctionReference<
      'mutation',
      'public',
      NoArgs,
      null
    >
  }
}
const requestsApi = api as unknown as {
  requests: {
    create: FunctionReference<'mutation', 'public', { prompt: string }, string>
    list: FunctionReference<
      'query',
      'public',
      { paginationOpts: { numItems: number; cursor: string | null } },
      RequestList
    >
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
  }
}

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  if (isLoading)
    return (
      <CenteredMessage
        title="Checking your secure session…"
        detail="Compari keeps your workspace private while it restores your session."
      />
    )
  if (!isAuthenticated) return <FirstSearch />
  return <Bootstrap />
}

function FirstSearch() {
  const { signIn } = useAuthActions()
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsStarting(true)
    try {
      window.sessionStorage.setItem(pendingFirstRequestKey, prompt.trim())
      await signIn('anonymous')
    } catch {
      setError(
        'We could not create your private workspace. Please try again.',
      )
    } finally {
      setIsStarting(false)
    }
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 p-8">
      <p className="text-sm font-semibold tracking-[0.22em] text-sky-600">
        COMPARI
      </p>
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Procurement research, with you in control.
        </h1>
        <p className="max-w-xl text-lg text-slate-600 dark:text-slate-300">
          Describe what you need. Your first search creates a private workspace
          that stays on this device.
        </p>
      </div>
      <form className="space-y-3" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm font-medium" htmlFor="first-request-prompt">
          What are you looking for?
        </label>
        <textarea
          className="min-h-32 w-full rounded-md border border-slate-300 bg-transparent p-3 dark:border-slate-700"
          id="first-request-prompt"
          minLength={12}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="For example: Find three Edmonton printers that can produce 500 event programs by next Friday within a $1,500 budget."
          required
          value={prompt}
        />
        <button
          className="rounded-md bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
          disabled={isStarting || prompt.trim().length < 12}
          type="submit"
        >
          {isStarting ? 'Creating your workspace…' : 'Start comparison'}
        </button>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </form>
    </main>
  )
}

function Bootstrap() {
  const ensureCurrentUser = useMutation(usersApi.users.ensureCurrentUser)
  const profile = useQuery(usersApi.users.current)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  useEffect(() => {
    if ((profile !== undefined && profile !== null) || bootstrapError) return
    void ensureCurrentUser({}).catch(() =>
      setBootstrapError(
        'We could not prepare your private workspace. Retry below; your sign-in is still active.',
      ),
    )
  }, [bootstrapError, ensureCurrentUser, profile])
  if (bootstrapError)
    return (
      <CenteredMessage
        title="Workspace setup needs a retry"
        detail={bootstrapError}
        action="Retry setup"
        onAction={() => setBootstrapError(null)}
      />
    )
  if (profile === undefined || profile === null)
    return (
      <CenteredMessage
        title="Preparing your buyer workspace…"
        detail="This only takes a moment and never sends email on your behalf."
      />
    )
  return <ProtectedShell profile={profile} />
}

function ProtectedShell({ profile }: { profile: Profile }) {
  const { signOut } = useAuthActions()
  const retryInbox = useMutation(usersApi.users.retryMyInboxProvisioning)
  const [retryError, setRetryError] = useState<string | null>(null)
  const status = profile.inboxProvisioningStatus ?? 'pending'
  const inboxDetail =
    status === 'ready'
      ? profile.agentEmailAddress
      : status === 'permanent_failure'
        ? 'Inbox setup needs support.'
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
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
          onClick={() => void signOut()}
          type="button"
        >
          Sign out
        </button>
      </header>
      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
          <h2 className="font-semibold">Account</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            {profile.name ?? profile.email ?? 'Private device workspace'}
          </p>
          {profile.email ? (
            <p className="text-sm text-slate-500">{profile.email}</p>
          ) : null}
        </article>
        <article className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
          <h2 className="font-semibold">Buyer inbox</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            {inboxDetail}
          </p>
          {status === 'retryable_failure' || status === 'permanent_failure' ? (
            <button
              className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
              onClick={() =>
                void retryInbox({}).catch(() =>
                  setRetryError(
                    'Inbox retry failed. Please try again shortly.',
                  ),
                )
              }
              type="button"
            >
              Retry inbox setup
            </button>
          ) : null}
          {retryError ? (
            <p className="mt-2 text-sm text-red-600">{retryError}</p>
          ) : null}
        </article>
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
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  )
  useEffect(() => {
    const pendingPrompt = window.sessionStorage.getItem(pendingFirstRequestKey)
    if (!pendingPrompt) return
    window.sessionStorage.removeItem(pendingFirstRequestKey)
    setPrompt(pendingPrompt)
    void create({ prompt: pendingPrompt })
      .then(() => setPrompt(''))
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message.replace(/^\w+:\s*/, '')
            : 'Unable to create request.',
        ),
      )
  }, [create])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      await create({ prompt })
      setPrompt('')
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message.replace(/^\w+:\s*/, '')
          : 'Unable to create request.',
      )
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
        <label className="block text-sm font-medium" htmlFor="request-prompt">
          What are you looking for?
        </label>
        <textarea
          className="min-h-28 w-full rounded-md border border-slate-300 bg-transparent p-3 dark:border-slate-700"
          id="request-prompt"
          minLength={12}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="For example: Find three Edmonton printers that can produce 500 event programs by next Friday within a $1,500 budget."
          required
          value={prompt}
        />
        <button
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
          disabled={prompt.trim().length < 12}
          type="submit"
        >
          Create request
        </button>
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
            <article
              className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              key={request._id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-semibold">{request.title}</h4>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {request.prompt}
                  </p>
                </div>
                <span className="rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                  {request.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                {request.candidateCounts.discovered} discovered ·{' '}
                {request.candidateCounts.qualified} qualified ·{' '}
                {request.candidateCounts.rejected} rejected ·{' '}
                {request.researchStatus}
              </p>
              <button
                className="mt-3 rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700"
                onClick={() =>
                  void (request.automationPaused
                    ? resume({ requestId: request._id })
                    : pause({ requestId: request._id }))
                }
                type="button"
              >
                {request.automationPaused
                  ? 'Resume research'
                  : 'Pause automation'}
              </button>
              <button
                className="ml-2 rounded border border-sky-300 px-3 py-1.5 text-sm"
                onClick={() => setSelectedRequestId(request._id)}
                type="button"
              >
                Open workspace
              </button>
              <DecisionPanel requestId={request._id} status={request.status} />
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function CenteredMessage({
  title,
  detail,
  action,
  onAction,
}: {
  title: string
  detail: string
  action?: string
  onAction?: () => void
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-slate-600 dark:text-slate-300">{detail}</p>
      {action && onAction ? (
        <button
          className="mt-2 w-fit rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
          onClick={onAction}
          type="button"
        >
          {action}
        </button>
      ) : null}
    </main>
  )
}
