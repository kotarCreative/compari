import { createFileRoute } from '@tanstack/react-router'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { CenteredMessage } from '~/components/common/CenteredMessage'
import { FirstSearch } from '~/features/workspace/FirstSearch'
import { WorkspaceShell } from '~/features/workspace/WorkspaceShell'
import { usersApi } from '~/features/workspace/contracts'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  if (isLoading)
    return (
      <CenteredMessage
        detail="Compari keeps your workspace private while it restores your session."
        title="Checking your secure session…"
      />
    )
  if (!isAuthenticated) return <FirstSearch />
  return <Bootstrap />
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
        action="Retry setup"
        detail={bootstrapError}
        onAction={() => setBootstrapError(null)}
        title="Workspace setup needs a retry"
      />
    )
  if (profile === undefined || profile === null)
    return (
      <CenteredMessage
        detail="This only takes a moment and never sends email on your behalf."
        title="Preparing your buyer workspace…"
      />
    )
  return <WorkspaceShell profile={profile} />
}
