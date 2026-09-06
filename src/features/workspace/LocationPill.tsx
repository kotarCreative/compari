import { useMutation } from 'convex/react'
import { useEffect, useState } from 'react'
import { usersApi } from './contracts'
import { Button, Input } from '~/components/ui'
import { errorMessage } from '~/lib/errors'

export function LocationPill({
  location,
  editable = true,
}: {
  location?: string
  editable?: boolean
}) {
  const saveLocation = useMutation(usersApi.users.setMyLocation)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(location ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditing) setDraft(location ?? '')
  }, [isEditing, location])

  if (!editable) return null

  async function save() {
    const nextLocation = draft.trim().replace(/\s+/g, ' ')
    if (nextLocation.length < 2 || nextLocation.length > 160) {
      setError('Enter a location between 2 and 160 characters.')
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      await saveLocation({ location: nextLocation })
      setIsEditing(false)
    } catch (reason) {
      setError(errorMessage(reason, 'Location could not be saved.'))
    } finally {
      setIsSaving(false)
    }
  }

  if (isEditing)
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Service location"
            autoFocus
            className="h-9 min-w-56 flex-1 rounded-full text-sm"
            maxLength={160}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void save()
              }
              if (event.key === 'Escape') setIsEditing(false)
            }}
            placeholder="City or area"
            value={draft}
          />
          <Button disabled={isSaving} onClick={() => void save()} size="sm">
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            disabled={isSaving}
            onClick={() => {
              setError(null)
              setIsEditing(false)
            }}
            size="sm"
            variant="ghost"
          >
            Cancel
          </Button>
        </div>
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    )

  return (
    <button
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-left text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
      onClick={() => {
        setDraft(location ?? '')
        setError(null)
        setIsEditing(true)
      }}
      type="button"
    >
      <span aria-hidden="true">⌖</span>
      <span className="truncate">
        {location ? `Service location: ${location}` : 'Add a service location'}
      </span>
      <span className="text-sky-700 dark:text-sky-300">Change</span>
    </button>
  )
}
