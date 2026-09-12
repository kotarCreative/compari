import { useAuthActions } from '@convex-dev/auth/react'
import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { DemoModeBanner } from '../decision/DemoModeBanner'
import { RequestDetail } from '../request/RequestDetail'
import { pendingFirstRequestKey } from './constants'
import { requestsApi } from './contracts'
import { FirstRequestOnboarding } from './FirstRequestOnboarding'
import type { Profile } from './contracts'
import { BrandLogo } from '~/components/common/BrandLogo'
import { NotebookPal } from '~/components/common/NotebookPal'
import { LoadingCards } from '~/components/common/ResearchLoader'
import { errorMessage } from '~/lib/errors'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-8">
        <div>
          <BrandLogo />
          <h1 className="mt-8 text-3xl font-bold tracking-tight">
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
      />
    </main>
  )
}

function RequestWorkspace({
  initialRequestId,
  initialRequestPrompt,
}: {
  initialRequestId: string | null
  initialRequestPrompt: string | null
}) {
  const pause = useMutation(requestsApi.requests.pauseAutomation)
  const resume = useMutation(requestsApi.requests.resumeAutomation)
  const requests = useQuery(requestsApi.requests.list, {
    paginationOpts: { numItems: 20, cursor: null },
  })
  const [error, setError] = useState<string | null>(null)
  const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(
    initialRequestPrompt,
  )
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(
    null,
  )
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    initialRequestId,
  )

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

  return (
    <section className="mt-10 space-y-8 pt-2">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Your requests</h2>
        <Link
          className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          to="/requests/new"
        >
          + New request
        </Link>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className={requests?.page.length ? 'request-notes' : 'space-y-3'}>
        {requests === undefined ? (
          <LoadingCards />
        ) : requests.page.length === 0 ? (
          <div className="welcome-page py-12 text-center">
            <NotebookPal className="mx-auto mb-4 w-28 text-slate-800" />
            <h3 className="text-xl font-semibold">
              Your next great find starts here.
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Tell us what you’re looking for. We’ll help turn a long list of
              possibilities into a clearer choice.
            </p>
            <Link
              className="marker-button mt-6 inline-flex font-hand text-2xl font-bold text-slate-900"
              to="/requests/new"
            >
              Create your first request <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          requests.page.map((request) => (
            <Card
              aria-label={`Open ${request.title} workspace`}
              className="sticky-note cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
              key={request._id}
              onClick={() => {
                setSubmittedPrompt(request.prompt)
                setSelectedRequestId(request._id)
              }}
              onKeyDown={(event) => {
                if (
                  event.target !== event.currentTarget ||
                  (event.key !== 'Enter' && event.key !== ' ')
                )
                  return

                event.preventDefault()
                setSubmittedPrompt(request.prompt)
                setSelectedRequestId(request._id)
              }}
              role="button"
              tabIndex={0}
            >
              <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-xl">{request.title}</CardTitle>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {request.prompt}
                  </p>
                </div>
                <StatusBadge status={request.status} />
              </CardHeader>
              <CardContent className="mt-auto">
                <dl className="grid grid-cols-3 gap-2 rounded-xl bg-white/60 text-center">
                  {[
                    ['Discovered', request.candidateCounts.discovered],
                    ['Qualified', request.candidateCounts.qualified],
                    ['Rejected', request.candidateCounts.rejected],
                  ].map(([label, value]) => (
                    <div className="px-2 py-3" key={label}>
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="mt-1 text-lg font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    disabled={updatingRequestId === request._id}
                    onClick={(event) => {
                      event.stopPropagation()
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
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  )
}
