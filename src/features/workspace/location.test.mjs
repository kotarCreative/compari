import assert from 'node:assert/strict'
import test from 'node:test'
import { formatApproximateLocation } from './location.ts'

test('rounds browser coordinates before they leave the device', () => {
  assert.equal(
    formatApproximateLocation(53.546124, -113.493823),
    'Approximate coordinates 53.55, -113.49',
  )
})
