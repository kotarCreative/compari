import { useAuthActions } from '@convex-dev/auth/react'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { DemoModeBanner } from '../decision/DemoModeBanner'
import { RequestDetail } from '../request/RequestDetail'
import { pendingFirstRequestKey, requestPromptPlaceholder } from './constants'
import { requestsApi } from './contracts'
import { FirstRequestOnboarding } from './FirstRequestOnboarding'
import { RequestConversation } from './RequestConversation'
import { LocationPill } from './LocationPill'
import type { Profile } from './contracts'
import type { FormEvent } from 'react'
import { LoadingCards } from '~/components/common/ResearchLoader'
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
  const [pendingFirstPrompt, setPendingFirstPrompt] = useState<
    string | null | undefined
  >(undefined)
  const [firstRequestId, setFirstRequestId] = useState<string | null>(null)
  const [firstRequestPrompt, setFirstRequestPrompt] = useState<string | null>(
    null,
  )

  useEffect(() => {
    setPendingFirstPrompt(window.sessionStorage.getItem(pendingFirstRequestKey))
  }, [])

  if (pendingFirstPrompt === undefined)
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <LoadingCards />
      </main>
    )
  if (pendingFirstPrompt)
    return (
      <FirstRequestOnboarding
        onComplete={(requestId) => {
          setFirstRequestId(requestId)
          setFirstRequestPrompt(pendingFirstPrompt)
          setPendingFirstPrompt(null)
        }}
        location={profile.location}
        prompt={pendingFirstPrompt}
      />
    )

  const firstName =
    profile.name?.trim().split(/\s+/)[0] ||
    profile.email?.split('@')[0] ||
    'there'

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
        <div>
          <p className="text-sm font-semibold tracking-[0.22em] text-sky-600">
            COMPARI
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            Welcome, {firstName}
            <span className="text-sky-600">.</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            A little clarity for your next big decision.
          </p>
        </div>
        <Button onClick={() => void signOut()} variant="outline">
          Sign out
        </Button>
      </header>
      <DemoModeBanner />
      <RequestWorkspace
        initialRequestId={firstRequestId}
        initialRequestPrompt={firstRequestPrompt}
        location={profile.location}
      />
    </main>
  )
}

function RequestWorkspace({
  initialRequestId,
  initialRequestPrompt,
  location,
}: {
  initialRequestId: string | null
  initialRequestPrompt: string | null
  location?: string
}) {
  const create = useMutation(requestsApi.requests.create)
  const pause = useMutation(requestsApi.requests.pauseAutomation)
  const resume = useMutation(requestsApi.requests.resumeAutomation)
  const requests = useQuery(requestsApi.requests.list, {
    paginationOpts: { numItems: 20, cursor: null },
  })
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(
    initialRequestPrompt,
  )
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(
    null,
  )
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    initialRequestId,
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const nextPrompt = prompt.trim()
    setSubmittedPrompt(nextPrompt)
    setIsCreating(true)
    try {
      const requestId = await create({
        prompt: nextPrompt,
        ...(location ? { location } : {}),
      })
      setPrompt('')
      setIsComposerOpen(false)
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
        onClose={() => {
          setSelectedRequestId(null)
          setSubmittedPrompt(null)
        }}
        requestPrompt={submittedPrompt ?? ''}
        requestId={selectedRequestId}
      />
    )

  if (isCreating && submittedPrompt)
    return (
      <section className="mt-8 border-t border-slate-200 pt-8 dark:border-slate-800">
        <RequestConversation
          loaderPhase="interpreting"
          prompt={submittedPrompt}
        />
      </section>
    )

  return (
    <section className="mt-8 space-y-5 border-t border-slate-200 pt-8 dark:border-slate-800">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Your requests</h2>
        <Button
          onClick={() => {
            setError(null)
            setIsComposerOpen((current) => !current)
          }}
          size="sm"
        >
          {isComposerOpen ? 'Close' : 'New request'}
        </Button>
      </div>
      {isComposerOpen ? (
        <form
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
          onSubmit={(event) => void submit(event)}
        >
          <Label htmlFor="request-prompt">What are you looking for?</Label>
          <Textarea
            autoFocus
            className="min-h-24"
            id="request-prompt"
            minLength={12}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={requestPromptPlaceholder}
            required
            value={prompt}
          />
          <LocationPill location={location} />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Compari will ask for any details it needs next.
            </p>
            <Button
              disabled={isCreating || prompt.trim().length < 12}
              size="sm"
              type="submit"
            >
              {isCreating ? 'Starting…' : 'Start comparison'}
            </Button>
          </div>
        </form>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="space-y-3">
        {requests === undefined ? (
          <LoadingCards />
        ) : requests.page.length === 0 ? (
          <div className="welcome-card py-12 text-center">
            <span
              aria-hidden="true"
              className="mb-4 inline-grid size-14 place-items-center rounded-2xl bg-sky-100 text-2xl text-sky-700"
            >
              ✦
            </span>
            <h3 className="text-xl font-semibold">
              Your next great find starts here.
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Tell us what you’re looking for. We’ll help turn a long list of
              possibilities into a clearer choice.
            </p>
            <Button className="mt-6" onClick={() => setIsComposerOpen(true)}>
              Create your first request <span aria-hidden="true">→</span>
            </Button>
          </div>
        ) : (
          requests.page.map((request) => (
            <Card className="transition hover:border-sky-300" key={request._id}>
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
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
                    onClick={() => {
                      setSubmittedPrompt(request.prompt)
                      setSelectedRequestId(request._id)
                    }}
                    size="sm"
                  >
                    Open workspace
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  )
}
