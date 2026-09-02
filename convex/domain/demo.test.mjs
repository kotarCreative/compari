import assert from 'node:assert/strict'
import test from 'node:test'
import { demoProviderMessageIds } from './demo.ts'

test('demo provider message identities are stable within a request', () => {
  assert.deepEqual(
    demoProviderMessageIds('request-a', 0),
    demoProviderMessageIds('request-a', 0),
  )
})

test('demo provider message identities do not collide across requests', () => {
  const first = demoProviderMessageIds('request-a', 0)
  const second = demoProviderMessageIds('request-b', 0)

  assert.notEqual(first.externalEventId, second.externalEventId)
  assert.notEqual(first.threadId, second.threadId)
  assert.notEqual(first.messageId, second.messageId)
})
