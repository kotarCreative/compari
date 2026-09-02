import assert from 'node:assert/strict'
import test from 'node:test'
import { AgentMailSdkAdapter } from '../adapters/agentMail.ts'
import { safeExternalError } from '../domain/inboxProvisioning.ts'

class FakeAgentMailPort {
  constructor(outcome) {
    this.outcome = outcome
    this.calls = []
  }
  async provisionInbox(input) {
    this.calls.push(input)
    if (this.outcome instanceof Error) throw this.outcome
    return this.outcome
  }
}

test('fake AgentMail port preserves a stable client id across a retry', async () => {
  const first = new FakeAgentMailPort(new Error('timeout'))
  await assert.rejects(() =>
    first.provisionInbox({
      username: 'alex',
      displayName: 'Alex',
      clientId: 'compari-user-u1-inbox-v1',
    }),
  )
  const retry = new FakeAgentMailPort({
    inboxId: 'inbox_1',
    emailAddress: 'alex@example.agentmail.to',
  })
  const inbox = await retry.provisionInbox(first.calls[0])
  assert.deepEqual(inbox, {
    inboxId: 'inbox_1',
    emailAddress: 'alex@example.agentmail.to',
  })
  assert.equal(retry.calls[0].clientId, 'compari-user-u1-inbox-v1')
  assert.equal(
    safeExternalError(new Error('timeout')).category,
    'retryable_external',
  )
})

test('fake AgentMail collision is a permanent failure', () => {
  assert.equal(
    safeExternalError(new Error('username collision')).category,
    'permanent_external',
  )
})

test('official AgentMail adapter maps inbox and idempotent message contracts', async () => {
  const calls = []
  const client = {
    pods: {
      list: async (input) => {
        calls.push(['listPods', input])
        return {
          pods: [{ podId: 'pod_demo', name: 'demo' }],
        }
      },
      inboxes: {
        create: async (...args) => {
          calls.push(['create', ...args])
          return { inboxId: 'inbox_1', email: 'buyer@agentmail.to' }
        },
      },
    },
    inboxes: {
      messages: {
        send: async (...args) => {
          calls.push(['send', ...args])
          return { messageId: 'msg_1', threadId: 'thread_1' }
        },
        reply: async (...args) => {
          calls.push(['reply', ...args])
          return { messageId: 'msg_2', threadId: 'thread_1' }
        },
        get: async (...args) => {
          calls.push(['get', ...args])
          return {
            messageId: 'msg_3',
            threadId: 'thread_1',
            from: 'provider@example.com',
            subject: 'Quote response',
            extractedText: 'The estimate is $500.',
            timestamp: new Date('2026-08-29T12:00:00Z'),
            attachments: [],
          }
        },
      },
    },
  }
  const adapter = new AgentMailSdkAdapter(() => client)
  assert.deepEqual(
    await adapter.provisionInbox({
      username: 'buyer',
      displayName: 'Buyer',
      clientId: 'buyer-v1',
    }),
    { inboxId: 'inbox_1', emailAddress: 'buyer@agentmail.to' },
  )
  assert.deepEqual(calls[0], ['listPods', { limit: 100 }])
  assert.deepEqual(calls[1], [
    'create',
    'pod_demo',
    { username: 'buyer', displayName: 'Buyer', clientId: 'buyer-v1' },
  ])
  assert.deepEqual(
    await adapter.sendMessage({
      inboxId: 'inbox_1',
      to: 'provider@example.com',
      subject: 'Quote',
      text: 'Please quote.',
      idempotencyKey: 'send-v1',
    }),
    { messageId: 'msg_1', threadId: 'thread_1' },
  )
  assert.deepEqual(
    await adapter.replyToMessage({
      inboxId: 'inbox_1',
      parentMessageId: 'msg_parent',
      text: 'Thanks.',
      idempotencyKey: 'reply-v1',
    }),
    { messageId: 'msg_2', threadId: 'thread_1' },
  )
  assert.deepEqual(
    await adapter.getMessage({ inboxId: 'inbox_1', messageId: 'msg_3' }),
    {
      threadId: 'thread_1',
      sender: 'provider@example.com',
      subject: 'Quote response',
      body: 'The estimate is $500.',
      occurredAt: Date.parse('2026-08-29T12:00:00Z'),
      attachments: [],
    },
  )
  assert.deepEqual(calls[2], [
    'send',
    'inbox_1',
    { to: ['provider@example.com'], subject: 'Quote', text: 'Please quote.' },
    { idempotencyKey: 'send-v1' },
  ])
  assert.deepEqual(calls[3], [
    'reply',
    'inbox_1',
    'msg_parent',
    { text: 'Thanks.' },
    { idempotencyKey: 'reply-v1' },
  ])
  assert.deepEqual(calls[4], ['get', 'inbox_1', 'msg_3'])
})

test('official AgentMail adapter retries a taken username deterministically', async () => {
  const calls = []
  const taken = Object.assign(new Error('Inbox is taken'), {
    statusCode: 403,
    body: { code: 'resource_taken' },
  })
  const client = {
    pods: {
      list: async () => ({ pods: [{ podId: 'pod_demo', name: 'demo' }] }),
      inboxes: {
        create: async (...args) => {
          calls.push(args)
          if (calls.length < 3) throw taken
          return { inboxId: 'inbox_2', email: 'buyer123@agentmail.to' }
        },
      },
    },
  }
  const adapter = new AgentMailSdkAdapter(() => client)

  assert.deepEqual(
    await adapter.provisionInbox({
      username: 'buyer',
      displayName: 'Buyer',
      clientId: 'compari-user-u1-inbox-v1',
    }),
    { inboxId: 'inbox_2', emailAddress: 'buyer123@agentmail.to' },
  )
  assert.equal(calls.length, 3)
  assert.equal(calls[0][1].username, 'buyer')
  assert.match(calls[1][1].username, /^buyer\d+$/)
  assert.equal(
    Number(calls[2][1].username.slice('buyer'.length)),
    Number(calls[1][1].username.slice('buyer'.length)) + 1,
  )
  assert.equal(calls[1][1].clientId, calls[0][1].clientId)
  assert.ok(calls[2][1].username.length <= 24)
})
