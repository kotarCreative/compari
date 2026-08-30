export type InboxProvisioningStatus =
  | 'pending'
  | 'provisioning'
  | 'ready'
  | 'retryable_failure'
  | 'permanent_failure'

export class DomainTransitionError extends Error {
  readonly category = 'invariant' as const
}

export function transitionInboxProvisioning(
  from: InboxProvisioningStatus,
  to: InboxProvisioningStatus,
): InboxProvisioningStatus {
  const allowed: Record<
    InboxProvisioningStatus,
    ReadonlyArray<InboxProvisioningStatus>
  > = {
    pending: ['provisioning', 'permanent_failure'],
    provisioning: ['ready', 'retryable_failure', 'permanent_failure'],
    ready: [],
    retryable_failure: ['provisioning', 'permanent_failure'],
    permanent_failure: ['provisioning'],
  }
  if (!allowed[from].includes(to))
    throw new DomainTransitionError(
      `Cannot transition inbox provisioning from ${from} to ${to}`,
    )
  return to
}
export function inboxJobKey(userId: string): string {
  return `provision-inbox:${userId}:v1`
}
export function inboxClientId(userId: string): string {
  return `compari-user-${userId}-inbox-v1`
}
export function chooseInboxUsername(name: string | null | undefined): string {
  const readable = (name ?? 'buyer')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24)
  return readable.length >= 3 ? readable : 'buyer'
}
export function safeExternalError(error: unknown): {
  category: 'retryable_external' | 'permanent_external'
  summary: string
} {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : 'unknown external failure'
  if (
    message.includes('429') ||
    message.includes('timeout') ||
    message.includes('temporar')
  )
    return {
      category: 'retryable_external',
      summary: 'Inbox provider is temporarily unavailable.',
    }
  if (
    message.includes('credential') ||
    message.includes('api key') ||
    message.includes('401') ||
    message.includes('403')
  )
    return {
      category: 'permanent_external',
      summary: 'Inbox provider credentials need attention.',
    }
  return {
    category: 'permanent_external',
    summary: 'Inbox provider rejected the provisioning request.',
  }
}
