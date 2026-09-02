export const pendingFirstRequestKey = 'compari.pending-first-request'
export const pendingFirstNameKey = 'compari.pending-first-name'
export const pendingLastNameKey = 'compari.pending-last-name'
export const onboardingStartedAtKey = 'compari.onboarding-started-at'
export const minimumOnboardingDurationMs = 5_000

export const requestPromptPlaceholder =
  'For example: Find three Edmonton printers that can produce 500 event programs by next Friday within a $1,500 budget.'

export function splitFullName(value: string): {
  firstName: string
  lastName: string
} | null {
  const parts = value.trim().split(/\s+/)
  if (parts.length < 2) return null
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')
  if (
    !firstName ||
    firstName.length > 40 ||
    !lastName ||
    lastName.length > 40 ||
    `${firstName} ${lastName}`.length > 60
  )
    return null
  return { firstName, lastName }
}
