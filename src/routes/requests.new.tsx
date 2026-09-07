import { createFileRoute } from '@tanstack/react-router'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { CenteredMessage } from '~/components/common/CenteredMessage'
import { OnboardingTransition } from '~/features/workspace/OnboardingTransition'
import { FirstSearch } from '~/features/workspace/FirstSearch'
import { NameOnboarding } from '~/features/workspace/NameOnboarding'
import { NewRequestPage } from '~/features/workspace/NewRequestPage'
import { usersApi } from '~/features/workspace/contracts'

export const Route = createFileRoute('/requests/new')({ component: NewRequest })

function NewRequest() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  if (isLoading)
    return <OnboardingTransition title="Restoring your secure session" />
  if (!isAuthenticated) return <FirstSearch />
  return <NewRequestBootstrap />
}

function NewRequestBootstrap() {
  const ensureCurrentUser = useMutation(usersApi.users.ensureCurrentUser)
  const profile = useQuery(usersApi.users.current)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if ((profile !== undefined && profile !== null) || error) return
    void ensureCurrentUser({}).catch(() =>
      setError('We could not prepare your private workspace. Please retry.'),
    )
  }, [ensureCurrentUser, error, profile])

  if (error)
    return (
      <CenteredMessage
        action="Retry setup"
        detail={error}
        onAction={() => setError(null)}
        title="Workspace setup needs a retry"
      />
    )
  if (profile === undefined || profile === null)
    return (
      <CenteredMessage
        detail="This only takes a moment."
        title="Preparing your buyer workspace…"
      />
    )
  if (!profile.hasConfirmedName) return <NameOnboarding profile={profile} />
  return <NewRequestPage profile={profile} />
}
