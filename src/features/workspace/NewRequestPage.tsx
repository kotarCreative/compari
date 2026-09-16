import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { RequestDetail } from '../request/RequestDetail'
import { FirstRequestOnboarding } from './FirstRequestOnboarding'
import { RequestChatLayout } from './RequestChatLayout'
import { RequestConversation } from './RequestConversation'
import { pendingFirstRequestKey } from './constants'
import type { Profile } from './contracts'
import { readSession, writeSession } from '~/lib/storage'

export function NewRequestPage({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [startedPrompt, setStartedPrompt] = useState<string | null>(() =>
    readSession(pendingFirstRequestKey),
  )
  const [completedRequestId, setCompletedRequestId] = useState<string | null>(
    null,
  )

  if (completedRequestId)
    return (
      <RequestChatLayout>
        <RequestDetail
          requestId={completedRequestId}
          requestPrompt={startedPrompt ?? ''}
          onClose={() => void navigate({ to: '/' })}
        />
      </RequestChatLayout>
    )

  if (startedPrompt)
    return (
      <FirstRequestOnboarding
        location={profile.location}
        onComplete={setCompletedRequestId}
        prompt={startedPrompt}
      />
    )

  return (
    <RequestChatLayout>
      <RequestConversation
        prompt=""
        answer={prompt}
        onAnswerChange={setPrompt}
        onAnswerSubmit={(event) => {
          event.preventDefault()
          const nextPrompt = prompt.trim()
          if (nextPrompt.length >= 12) {
            writeSession(pendingFirstRequestKey, nextPrompt)
            setStartedPrompt(nextPrompt)
          }
        }}
        canEditLocation
        location={profile.location}
      />
      <Link
        className="inline-flex min-h-11 items-center text-sm text-slate-500 hover:underline"
        to="/"
      >
        Back to requests
      </Link>
    </RequestChatLayout>
  )
}
