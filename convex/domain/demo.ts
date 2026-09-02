export function demoProviderMessageIds(requestId: string, index: number) {
  const scope = `${requestId}:${index}:v1`
  return {
    externalEventId: `demo-reply:${scope}`,
    threadId: `demo-thread:${scope}`,
    messageId: `demo-message:${scope}`,
  }
}
