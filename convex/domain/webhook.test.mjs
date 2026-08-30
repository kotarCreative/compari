import assert from 'node:assert/strict'
import test from 'node:test'
import { isFreshSvixTimestamp, normalizeVerifiedAgentMailEvent, readSvixHeaders } from './webhook.ts'

test('webhook normalization preserves only safe message fields and extracted body precedence', () => {
  const event = normalizeVerifiedAgentMailEvent({ event_type: 'message.received', event_id: 'evt_1', message: { inbox_id: 'inbox_1', message_id: 'msg_1', thread_id: 'thread_1', from: 'x@example.test', extracted_text: 'reply only', text: 'quoted history', attachments: [{ attachment_id: 'att_1', filename: 'quote.pdf', download_url: 'secret' }] } })
  assert.equal(event?.body, 'reply only')
  assert.deepEqual(event?.attachments, [{ id: 'att_1', filename: 'quote.pdf', contentType: undefined, size: undefined }])
})
test('webhook headers require all Svix fields and stale timestamps fail', () => {
  assert.equal(readSvixHeaders({ get: (name) => name === 'svix-id' ? 'id' : null }), null)
  assert.equal(isFreshSvixTimestamp('1000000000', 1_000_000_000_000, 1_000), true)
  assert.equal(isFreshSvixTimestamp('1000000000', 1_000_000_100_000, 1_000), false)
})
