import { Navigate, createFileRoute } from '@tanstack/react-router'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { CenteredMessage } from '~/components/common/CenteredMessage'
import { FirstSearch } from '~/features/workspace/FirstSearch'
import { NameOnboarding } from '~/features/workspace/NameOnboarding'
import { WorkspaceShell } from '~/features/workspace/WorkspaceShell'
import { usersApi } from '~/features/workspace/contracts'
import { pendingFirstRequestKey } from '~/features/workspace/constants'
import { RequestChatLayout } from '~/features/workspace/RequestChatLayout'
import { RequestConversation } from '~/features/workspace/RequestConversation'
import { publicUrl, siteDescription, siteOrigin } from '~/lib/seo'

export const Route = createFileRoute('/')({
  head: () => ({
    links: siteOrigin ? [{ rel: 'canonical', href: publicUrl('/') }] : [],
    scripts: siteOrigin
      ? [
          {
            type: 'application/ld+json',
            children: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Compari',
              url: publicUrl('/'),
              description: siteDescription,
              inLanguage: 'en',
            }).replace(/</g, '\\u003c'),
          },
        ]
      : [],
  }),
  component: Home,
})

function Home() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  if (isLoading) return <FirstSearch isSessionLoading />
  if (!isAuthenticated) return <FirstSearch />
  return <Bootstrap />
}

function Bootstrap() {
  const ensureCurrentUser = useMutation(usersApi.users.ensureCurrentUser)
  const profile = useQuery(usersApi.users.current)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [isFinishingIntroduction, setIsFinishingIntroduction] = useState(false)

  useEffect(() => {
    // Remember the introduction across the reactive profile update. The name
    // form can unmount before its save promise resolves.
    if (profile && !profile.hasConfirmedName) setIsFinishingIntroduction(true)
    else if (
      profile?.hasConfirmedName &&
      window.sessionStorage.getItem(pendingFirstRequestKey)
    )
      setIsFinishingIntroduction(false)
  }, [profile])

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
        action="Retry setup"
        detail={bootstrapError}
        onAction={() => setBootstrapError(null)}
        title="Workspace setup needs a retry"
      />
    )
  if (profile === undefined || profile === null) {
    const pendingPrompt = window.sessionStorage.getItem(pendingFirstRequestKey)
    if (pendingPrompt)
      return (
        <RequestChatLayout>
          <RequestConversation
            prompt={pendingPrompt}
            loaderPhase="interpreting"
          />
        </RequestChatLayout>
      )
    return (
      <CenteredMessage
        detail="This only takes a moment and never sends email on your behalf."
        title="Preparing your buyer workspace…"
      />
    )
  }
  if (!profile.hasConfirmedName) return <NameOnboarding profile={profile} />
  if (
    isFinishingIntroduction &&
    !window.sessionStorage.getItem(pendingFirstRequestKey)
  )
    return <Navigate to="/requests/new" replace />
  return <WorkspaceShell profile={profile} />
}
