import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyExternalError,
  validateOutboundPreflight,
} from './outboundPolicy.ts'

const allowed = {
  requestStatus: 'contacting',
  requestVersion: 3,
  jobInputVersion: 3,
  paused: false,
  candidateQueued: true,
  endpointType: 'email',
  endpointVerified: true,
  endpointValue: 'quotes@example.test',
  stableReplyAddress: 'agent@reply.test',
  previousSucceeded: false,
  withinCap: true,
  subject: 'Information request: printing',
  body: 'Please share price, availability, scope, exclusions, and timing.',
}

test('outbound preflight permits only a bounded factual request', () => {
  assert.equal(validateOutboundPreflight(allowed), null)
  assert.equal(
    validateOutboundPreflight({ ...allowed, paused: true }),
    'request is not permitted to contact providers',
  )
  assert.equal(
    validateOutboundPreflight({ ...allowed, jobInputVersion: 2 }),
    'outreach input is stale',
  )
  assert.equal(
    validateOutboundPreflight({ ...allowed, withinCap: false }),
    'ranked shortlist contact cap reached',
  )
  assert.equal(
    validateOutboundPreflight({ ...allowed, previousSucceeded: true }),
    'outreach relationship or endpoint is no longer eligible',
  )
})

test('outbound preflight rejects commitment, secrets, and personal data', () => {
  assert.match(
    validateOutboundPreflight({ ...allowed, body: 'We accept your offer.' }),
    /commitment/,
  )
  assert.match(
    validateOutboundPreflight({ ...allowed, body: 'Our API key is abc.' }),
    /restricted data/,
  )
  assert.match(
    validateOutboundPreflight({ ...allowed, body: 'Call 555-123-4567.' }),
    /restricted data/,
  )
  assert.equal(
    validateOutboundPreflight({
      ...allowed,
      endpointType: 'form',
      endpointValue: 'https://example.test/contact',
    }),
    'contact-form automation is not enabled',
  )
})

test('external errors classify retryability deterministically', () => {
  assert.deepEqual(
    classifyExternalError(new Error('retryable_external: rate limited')),
    { retryable: true, summary: 'rate limited' },
  )
  assert.equal(
    classifyExternalError(new Error('permanent_external: invalid request'))
      .retryable,
    false,
  )
  assert.equal(classifyExternalError(new Error('timeout')).retryable, true)
})
