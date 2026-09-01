'use node'
import { AgentMailClient } from 'agentmail'
import { isDemoMode, requireDeploymentEnv } from './runtime.ts'
import type {
  AgentMailPort,
  ProvisionInboxInput,
  ProvisionedInbox,
} from '../ports/agentMail'

const AGENTMAIL_POD_NAME = 'demo'

let port: AgentMailPort | undefined
export function getAgentMailPort(): AgentMailPort {
  port ??= isDemoMode() ? new DemoAgentMailAdapter() : new AgentMailSdkAdapter()
  return port
}

/** Deterministic local fixture; it never opens a network connection. */
class DemoAgentMailAdapter implements AgentMailPort {
  provisionInbox(input: ProvisionInboxInput): Promise<ProvisionedInbox> {
    return Promise.resolve({
      inboxId: `demo-inbox-${input.clientId}`,
      emailAddress: `${input.username || 'buyer'}@demo.agentmail.test`,
    })
  }
  sendMessage(input: {
    idempotencyKey: string
  }): Promise<{ messageId: string; threadId: string }> {
    return Promise.resolve({
      messageId: `demo-outreach-${stableId(input.idempotencyKey)}`,
      threadId: `demo-thread-${stableId(input.idempotencyKey)}`,
    })
  }
  replyToMessage(input: {
    idempotencyKey: string
    parentMessageId: string
  }): Promise<{ messageId: string; threadId: string }> {
    return Promise.resolve({
      messageId: `demo-reply-${stableId(`${input.parentMessageId}:${input.idempotencyKey}`)}`,
      threadId: `demo-thread-${stableId(input.parentMessageId)}`,
    })
  }
  getMessage(input: { inboxId: string; messageId: string }) {
    return Promise.resolve({
      threadId: `demo-thread-${stableId(input.messageId)}`,
      sender: 'provider@demo.agentmail.test',
      subject: 'Demo provider reply',
      body: 'Demo provider response.',
      occurredAt: Date.now(),
      attachments: [],
    })
  }
}

export class AgentMailSdkAdapter implements AgentMailPort {
  private readonly clientFactory: () => AgentMailClient
  private podIdPromise: Promise<string> | undefined

  constructor(
    clientFactory: () => AgentMailClient = () => {
      const apiKey = requireDeploymentEnv(
        'AGENTMAIL_API_KEY',
        'AgentMail credentials are missing',
      )
      return new AgentMailClient({ apiKey, maxRetries: 2 })
    },
  ) {
    this.clientFactory = clientFactory
  }

  private client(): AgentMailClient {
    return this.clientFactory()
  }

  private podId(): Promise<string> {
    this.podIdPromise ??= this.findPodId()
    return this.podIdPromise
  }

  private async findPodId(): Promise<string> {
    const client = this.client()
    const matchingPodIds: Array<string> = []
    let pageToken: string | undefined
    do {
      const page = await client.pods.list({
        limit: 100,
        ...(pageToken === undefined ? {} : { pageToken }),
      })
      matchingPodIds.push(
        ...page.pods
          .filter(
            (pod) =>
              pod.name.trim().toLowerCase() ===
              AGENTMAIL_POD_NAME.toLowerCase(),
          )
          .map((pod) => pod.podId),
      )
      pageToken = page.nextPageToken
    } while (pageToken !== undefined)

    if (matchingPodIds.length === 0)
      throw new Error(`AgentMail pod "${AGENTMAIL_POD_NAME}" was not found`)
    if (matchingPodIds.length > 1)
      throw new Error(
        `Multiple AgentMail pods are named "${AGENTMAIL_POD_NAME}"`,
      )
    return matchingPodIds[0]
  }

  async provisionInbox(input: ProvisionInboxInput): Promise<ProvisionedInbox> {
    const client = this.client()
    const inbox = await client.pods.inboxes.create(await this.podId(), {
      username: input.username,
      displayName: input.displayName,
      clientId: input.clientId,
    })
    return { inboxId: inbox.inboxId, emailAddress: inbox.email }
  }

  async sendMessage(input: {
    inboxId: string
    to: string
    subject: string
    text: string
    idempotencyKey: string
  }) {
    const sent = await this.client().inboxes.messages.send(
      input.inboxId,
      { to: [input.to], subject: input.subject, text: input.text },
      { idempotencyKey: input.idempotencyKey },
    )
    return { messageId: sent.messageId, threadId: sent.threadId }
  }

  async replyToMessage(input: {
    inboxId: string
    parentMessageId: string
    text: string
    idempotencyKey: string
  }) {
    const sent = await this.client().inboxes.messages.reply(
      input.inboxId,
      input.parentMessageId,
      { text: input.text },
      { idempotencyKey: input.idempotencyKey },
    )
    return { messageId: sent.messageId, threadId: sent.threadId }
  }

  async getMessage(input: { inboxId: string; messageId: string }) {
    const message = await this.client().inboxes.messages.get(
      input.inboxId,
      input.messageId,
    )
    const body =
      message.extractedText ??
      message.text ??
      message.extractedHtml ??
      message.html ??
      ''
    return {
      threadId: message.threadId,
      sender: message.from,
      subject: message.subject ?? '(no subject)',
      body: body.slice(0, 40_000),
      occurredAt: message.timestamp.getTime(),
      attachments: (message.attachments ?? [])
        .slice(0, 20)
        .map((attachment) => ({
          id: attachment.attachmentId,
          ...(attachment.filename === undefined
            ? {}
            : { filename: attachment.filename }),
          ...(attachment.contentType === undefined
            ? {}
            : { contentType: attachment.contentType }),
          size: attachment.size,
        })),
    }
  }
}

function stableId(value: string) {
  let hash = 2166136261
  for (const char of value)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 0).toString(36)
}
