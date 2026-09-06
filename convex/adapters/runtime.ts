declare const process: { env: Record<string, string | undefined> }

export function deploymentEnv(name: string): string | undefined {
  return process.env[name]
}

export function requireDeploymentEnv(name: string, message: string): string {
  const value = deploymentEnv(name)
  if (!value) throw new Error(message)
  return value
}

export function isDemoMode(): boolean {
  return deploymentEnv('COMPARI_DEMO_MODE') === 'true'
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500
}

export function retryAfterDelayMs(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0)
    return Math.min(seconds * 1_000, 5 * 60_000)
  const date = Date.parse(value)
  if (!Number.isFinite(date)) return undefined
  return Math.min(Math.max(0, date - now), 5 * 60_000)
}
