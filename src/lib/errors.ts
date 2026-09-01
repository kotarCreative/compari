export function errorMessage(
  reason: unknown,
  fallback = 'Action could not be completed.',
): string {
  return reason instanceof Error
    ? reason.message.replace(/^\w+:\s*/, '')
    : fallback
}
