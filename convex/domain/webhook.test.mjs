import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import {
  isFreshSvixTimestamp,
  normalizeVerifiedAgentMailEvent,
  readSvixHeaders,
  verifySvixSignature,
} from './webhook.ts'

test('webhook normalization preserves only safe message fields and extracted body precedence', () => {
  const event = normalizeVerifiedAgentMailEvent({
    event_type: 'message.received',
    event_id: 'evt_1',
    message: {
      inbox_id: 'inbox_1',
      message_id: 'msg_1',
      thread_id: 'thread_1',
      from: 'x@example.test',
      extracted_text: 'reply only',
      text: 'quoted history',
      attachments: [
        {
          attachment_id: 'att_1',
          filename: 'quote.pdf',
          download_url: 'secret',
        },
      ],
    },
  })
  assert.equal(event?.body, 'reply only')
  assert.deepEqual(event?.attachments, [
    {
      id: 'att_1',
      filename: 'quote.pdf',
      contentType: undefined,
      size: undefined,
    },
  ])
})
test('webhook headers require all Svix fields and stale timestamps fail', () => {
  assert.equal(
    readSvixHeaders({ get: (name) => (name === 'svix-id' ? 'id' : null) }),
    null,
  )
  assert.equal(
    isFreshSvixTimestamp('1000000000', 1_000_000_000_000, 1_000),
    true,
  )
  assert.equal(
    isFreshSvixTimestamp('1000000000', 1_000_000_100_000, 1_000),
    false,
  )
})
test('signed raw webhook bodies verify and tampered bodies fail', async () => {
  const rawBody = '{"event_type":"message.received","event_id":"event_1"}'
  const secretBytes = Buffer.from('compari-test-webhook-secret')
  const headers = {
    id: 'msg_delivery_1',
    timestamp: '1788000000',
    signature: '',
  }
  headers.signature = `v1,${createHmac('sha256', secretBytes)
    .update(`${headers.id}.${headers.timestamp}.${rawBody}`)
    .digest('base64')}`
  const secret = `whsec_${secretBytes.toString('base64')}`
  assert.equal(await verifySvixSignature(rawBody, headers, secret), true)
  assert.equal(await verifySvixSignature(`${rawBody} `, headers, secret), false)
})
