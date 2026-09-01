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
