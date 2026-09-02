import { useEffect, useState } from 'react'

const progressMessages = [
  'Saving your details securely.',
  'Creating your private buyer workspace.',
  'Preparing your first comparison.',
  'Getting everything ready for review.',
]

export function OnboardingTransition({
  firstName,
  title = 'Preparing your comparison…',
}: {
  firstName?: string
  title?: string
}) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(
      () =>
        setMessageIndex((current) => (current + 1) % progressMessages.length),
      1_250,
    )
    return () => window.clearInterval(interval)
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center p-8 text-center">
      <div
        aria-hidden="true"
        className="relative mb-8 flex h-20 w-20 items-center justify-center"
      >
        <span className="animate-onboarding-orbit absolute inset-0 rounded-full border-2 border-sky-200 border-t-sky-600 dark:border-sky-900 dark:border-t-sky-400" />
        <span className="animate-onboarding-pulse h-10 w-10 rounded-full bg-sky-100 dark:bg-sky-950" />
      </div>
      <div aria-live="polite" role="status">
        <p className="text-sm font-semibold tracking-[0.22em] text-sky-600">
          COMPARI
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          {firstName ? `${title}, ${firstName}` : title}
        </h1>
        <p className="mt-3 min-h-6 text-slate-600 dark:text-slate-300">
          {progressMessages[messageIndex]}
        </p>
        <div className="mt-6 flex justify-center gap-2" aria-hidden="true">
          <span className="animate-onboarding-dot h-2 w-2 rounded-full bg-sky-600" />
          <span className="animate-onboarding-dot h-2 w-2 rounded-full bg-sky-600 [animation-delay:140ms]" />
          <span className="animate-onboarding-dot h-2 w-2 rounded-full bg-sky-600 [animation-delay:280ms]" />
        </div>
      </div>
    </main>
  )
}
