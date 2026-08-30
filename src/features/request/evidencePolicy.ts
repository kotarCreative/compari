export function safeEvidenceUrl(value?: string) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString()
      : null
  } catch {
    return null
  }
}

export function displayEvidenceValue(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return 'Evidence value unavailable.'
  }
}
