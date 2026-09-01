import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DomainTransitionError,
  chooseInboxUsername,
  inboxClientId,
  inboxJobKey,
  safeExternalError,
  transitionInboxProvisioning,
} from './inboxProvisioning.ts'

test('inbox transitions are explicit and reject stale completion', () => {
  assert.equal(
    transitionInboxProvisioning('pending', 'provisioning'),
    'provisioning',
  )
  assert.equal(transitionInboxProvisioning('provisioning', 'ready'), 'ready')
  assert.throws(
    () => transitionInboxProvisioning('ready', 'provisioning'),
    DomainTransitionError,
  )
})

test('inbox identity values are deterministic and private', () => {
  assert.equal(chooseInboxUsername('Álex Buyer!'), 'alexbuyer')
  assert.equal(chooseInboxUsername('x'), 'buyer')
  assert.equal(inboxJobKey('user_123'), 'provision-inbox:user_123:v1')
  assert.equal(inboxClientId('user_123'), 'compari-user-user_123-inbox-v1')
})

test('external failures expose safe, actionable categories', () => {
  assert.deepEqual(safeExternalError(new Error('429 timeout')), {
    category: 'retryable_external',
    summary: 'Inbox provider is temporarily unavailable.',
  })
  assert.deepEqual(safeExternalError(new Error('401 invalid API key')), {
    category: 'permanent_external',
    summary: 'Inbox provider credentials need attention.',
  })
  assert.deepEqual(safeExternalError({ statusCode: 503 }), {
    category: 'retryable_external',
    summary: 'Inbox provider is temporarily unavailable.',
  })
  assert.deepEqual(safeExternalError({ statusCode: 401 }), {
    category: 'permanent_external',
    summary: 'Inbox provider credentials need attention.',
  })
  assert.deepEqual(
    safeExternalError(new Error('AgentMail pod "demo" was not found')),
    {
      category: 'permanent_external',
      summary: 'AgentMail pod "demo" was not found.',
    },
  )
  assert.deepEqual(safeExternalError({ statusCode: 422 }), {
    category: 'permanent_external',
    summary: 'AgentMail rejected the inbox details for pod "demo".',
  })
})
