import assert from 'node:assert/strict'
import test from 'node:test'
import { safeExternalError } from '../domain/inboxProvisioning.ts'

class FakeAgentMailPort {
  constructor(outcome) { this.outcome = outcome; this.calls = [] }
  async provisionInbox(input) {
    this.calls.push(input)
    if (this.outcome instanceof Error) throw this.outcome
    return this.outcome
  }
}

test('fake AgentMail port preserves a stable client id across a retry', async () => {
  const first = new FakeAgentMailPort(new Error('timeout'))
  await assert.rejects(() => first.provisionInbox({ username: 'alex', displayName: 'Alex', clientId: 'compari-user-u1-inbox-v1' }))
  const retry = new FakeAgentMailPort({ inboxId: 'inbox_1', emailAddress: 'alex@example.agentmail.to' })
  const inbox = await retry.provisionInbox(first.calls[0])
  assert.deepEqual(inbox, { inboxId: 'inbox_1', emailAddress: 'alex@example.agentmail.to' })
  assert.equal(retry.calls[0].clientId, 'compari-user-u1-inbox-v1')
  assert.equal(safeExternalError(new Error('timeout')).category, 'retryable_external')
})

test('fake AgentMail collision is a permanent failure', () => {
  assert.equal(safeExternalError(new Error('username collision')).category, 'permanent_external')
})
