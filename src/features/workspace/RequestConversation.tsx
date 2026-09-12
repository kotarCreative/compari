import { useEffect, useRef } from 'react'
import {
  RotatingProgressText,
  interpretationProgressMessages,
  vendorSearchProgressMessages,
} from './OnboardingTransition'
import { LocationPill } from './LocationPill'
import type { FormEvent } from 'react'
import { ResearchLoader } from '~/components/common/ResearchLoader'
import { Button, Label, Textarea } from '~/components/ui'

export function RequestConversation({
  prompt,
  history = [],
  showHistory = true,
  question,
  answer = '',
  error,
  isAnswering = false,
  loaderPhase,
  onAnswerChange,
  onAnswerSubmit,
  location,
  canEditLocation = false,
  suggestions = [],
}: {
  showHistory?: boolean
  prompt: string
  history?: Array<{
    id: string
    text: string
    importance: string
    answer: string
  }>
  question?: { _id?: string; text: string; importance: string }
  answer?: string
  error?: string | null
  isAnswering?: boolean
  loaderPhase?: 'interpreting' | 'vendors'
  onAnswerChange?: (value: string) => void
  onAnswerSubmit?: (event: FormEvent<HTMLFormElement>) => void
  location?: string
  canEditLocation?: boolean
  suggestions?: Array<string>
}) {
  const answerInput = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!question && prompt) return
    answerInput.current?.focus()
  }, [question?._id, prompt])

  const previousMessages = (
    <>
      <QuestionBubble
        question={{ text: 'What can we help you find?', importance: 'initial' }}
      />
      {prompt ? (
        <div className="flex justify-end">
          <p className="max-w-[88%] whitespace-pre-wrap bg-sky-100/40 px-4 py-3 text-sm leading-6 text-slate-800">
            {prompt}
          </p>
        </div>
      ) : null}
      {history.map((item) => (
        <div className="space-y-3" key={item.id}>
          <QuestionBubble question={item} />
          <div className="flex justify-end">
            <p className="max-w-[88%] whitespace-pre-wrap bg-sky-100/40 px-4 py-3 text-sm leading-6 text-slate-800">
              {item.answer}
            </p>
          </div>
        </div>
      ))}
    </>
  )
  return (
    <section
      aria-label="Request conversation"
      className="mx-auto w-full max-w-2xl space-y-4"
    >
      <div role="log" aria-label="Chat history" className="space-y-4">
        {showHistory ? previousMessages : null}
        {question ? <QuestionBubble question={question} /> : null}
      </div>

      {question || (!prompt && onAnswerSubmit) ? (
        <div className="space-y-3">
          <form className="space-y-2" onSubmit={onAnswerSubmit}>
            <Label className="sr-only" htmlFor="request-conversation-answer">
              {prompt ? 'Your answer' : 'Your request'}
            </Label>
            <Textarea
              autoFocus
              className="min-h-24 text-2xl"
              disabled={isAnswering}
              id="request-conversation-answer"
              ref={answerInput}
              onChange={(event) => onAnswerChange?.(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              placeholder={
                prompt
                  ? 'Type your answer here…'
                  : 'Tell us what you’re looking for…'
              }
              minLength={prompt ? 1 : 12}
              required
              value={answer}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Press <kbd className="font-sans">⌘/Ctrl</kbd> +{' '}
                <kbd className="font-sans">Enter</kbd> to send.
              </p>
              <Button
                disabled={
                  isAnswering || answer.trim().length < (prompt ? 1 : 12)
                }
                size="sm"
                type="submit"
              >
                {isAnswering
                  ? 'Saving…'
                  : prompt
                    ? 'Answer'
                    : 'Find my options'}
              </Button>
            </div>
          </form>
          {!prompt && suggestions.length ? (
            <div
              aria-label="Example requests"
              className="flex flex-col items-start"
            >
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  className="suggestion-chip"
                  type="button"
                  onClick={() => onAnswerChange?.(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : loaderPhase ? (
        <div className="animate-onboarding-welcome pl-5 py-2">
          <ResearchLoader />
          <div
            aria-live="polite"
            className="space-y-1 pl-1 text-sm text-slate-600 dark:text-slate-300"
            role="status"
          >
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {loaderPhase === 'interpreting'
                ? 'Interpreting your request…'
                : 'Looking for vendors…'}
            </p>
            <RotatingProgressText
              messages={
                loaderPhase === 'interpreting'
                  ? interpretationProgressMessages
                  : vendorSearchProgressMessages
              }
            />
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Your results and any follow-up questions will appear here.
          </p>
        </div>
      ) : (
        <p
          aria-live="polite"
          className="pl-1 text-sm text-slate-600 dark:text-slate-300"
          role="status"
        >
          Your conversation is saved here. Any new questions will appear below.
        </p>
      )}

      {canEditLocation ? <LocationPill location={location} /> : null}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function QuestionBubble({
  question,
}: {
  question: { text: string; importance: string }
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          Compari
        </p>
        <p className="mt-1 text-sm leading-6">{question.text}</p>
      </div>
    </div>
  )
}
