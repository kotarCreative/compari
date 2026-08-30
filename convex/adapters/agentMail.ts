'use node'
import type {
  AgentMailPort,
  ProvisionInboxInput,
  ProvisionedInbox,
} from '../ports/agentMail'

declare const process: { env: Record<string, string | undefined> }

let port: AgentMailPort | undefined
export function getAgentMailPort(): AgentMailPort {
  port ??= process.env.COMPARI_DEMO_MODE === 'true' ? new DemoAgentMailAdapter() : new AgentMailHttpAdapter()
  return port
}

/** Deterministic local fixture; it never opens a network connection. */
class DemoAgentMailAdapter implements AgentMailPort {
  provisionInbox(input: ProvisionInboxInput): Promise<ProvisionedInbox> {
    return Promise.resolve({ inboxId: `demo-inbox-${input.clientId}`, emailAddress: `${input.username || 'buyer'}@demo.agentmail.test` })
  }
  sendMessage(input: { idempotencyKey: string }): Promise<{ messageId: string }> {
    return Promise.resolve({ messageId: `demo-outreach-${stableId(input.idempotencyKey)}` })
  }
  replyToMessage(input: { idempotencyKey: string; parentMessageId: string }): Promise<{ messageId: string }> {
    return Promise.resolve({ messageId: `demo-reply-${stableId(`${input.parentMessageId}:${input.idempotencyKey}`)}` })
  }
}

class AgentMailHttpAdapter implements AgentMailPort {
  async provisionInbox(input: ProvisionInboxInput): Promise<ProvisionedInbox> {
    const apiKey = process.env.AGENTMAIL_API_KEY
    if (!apiKey) throw new Error('AgentMail credentials are missing')
    const response = await fetch('https://api.agentmail.to/v0/inboxes', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: input.username,
        displayName: input.displayName,
        clientId: input.clientId,
      }),
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok)
      throw new Error(`AgentMail inbox creation failed (${response.status})`)
    if (!isProvisionedInbox(payload))
      throw new Error('AgentMail returned an invalid inbox response')
    return payload
  }
  sendMessage(): Promise<never> {
    // Do not guess an idempotency API for sends. Specs require reconciliation
    // before retrying an uncertain email, so this remains fail-closed until the
    // AgentMail SDK and its supported correlation primitive are installed.
    return Promise.reject(
      new Error('needs_user: outbound AgentMail delivery is not configured'),
    )
  }
  replyToMessage(): Promise<never> {
    return Promise.reject(
      new Error('needs_user: AgentMail reply reconciliation is not configured'),
    )
  }
}
function isProvisionedInbox(value: unknown): value is ProvisionedInbox {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).inboxId === 'string' &&
    typeof (value as Record<string, unknown>).emailAddress === 'string'
  )
}
function stableId(value: string) {
  let hash = 2166136261
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 0).toString(36)
}
