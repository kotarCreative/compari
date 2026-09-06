export function retryDelayMs(attemptCount: number, minimumDelayMs = 0): number {
  const exponentialDelay =
    1_000 * 2 ** Math.max(0, Math.min(attemptCount - 1, 5))
  return Math.max(
    exponentialDelay,
    Math.max(0, Math.min(minimumDelayMs, 5 * 60_000)),
  )
}

export function candidateResearchDelayMs(index: number): number {
  return Math.max(0, Math.floor(index)) * 7_000
}

export function canRetryJob(input: {
  retryable: boolean
  attemptCount: number
  maxAttempts?: number
}): boolean {
  return input.retryable && input.attemptCount < (input.maxAttempts ?? 3)
}

export function canClaimJob(
  input: { status: string; leaseExpiresAt?: number },
  now: number,
): boolean {
  return (
    input.status === 'pending' ||
    input.status === 'retryable_failure' ||
    (input.status === 'running' && (input.leaseExpiresAt ?? 0) <= now)
  )
}
