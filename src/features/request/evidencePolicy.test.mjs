import assert from 'node:assert/strict'
import test from 'node:test'
import { displayEvidenceValue, safeEvidenceUrl } from './evidencePolicy.ts'

test('evidence links permit only http and https', () => {
  assert.equal(
    safeEvidenceUrl('https://example.com/evidence'),
    'https://example.com/evidence',
  )
  assert.equal(safeEvidenceUrl('javascript:alert(1)'), null)
  assert.equal(safeEvidenceUrl('data:text/html,unsafe'), null)
  assert.equal(safeEvidenceUrl('not a url'), null)
})

test('evidence display keeps data as text rather than executable markup', () => {
  assert.equal(
    displayEvidenceValue('<img src=x onerror=alert(1)>'),
    '"<img src=x onerror=alert(1)>"',
  )
})
