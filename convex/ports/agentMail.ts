export type ProvisionInboxInput = {
  username: string
  displayName: string
  clientId: string
}
export type ProvisionedInbox = { inboxId: string; emailAddress: string }
export type SentMessage = { messageId: string; threadId?: string }
export interface AgentMailPort {
  provisionInbox: (input: ProvisionInboxInput) => Promise<ProvisionedInbox>
  sendMessage: (input: {
    inboxId: string
    to: string
    subject: string
    text: string
    idempotencyKey: string
  }) => Promise<SentMessage>
  replyToMessage: (input: {
    inboxId: string
    parentMessageId: string
    text: string
    idempotencyKey: string
  }) => Promise<SentMessage>
}
