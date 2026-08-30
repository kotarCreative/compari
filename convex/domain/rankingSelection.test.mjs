import assert from 'node:assert/strict'
import test from 'node:test'
import { outreachJobsForSelection, validateBuyerSelection } from './rankingSelection.ts'

const candidates = [{ id: 'a', requestId: 'r1', recommended: true, current: true, contactable: true }, { id: 'b', requestId: 'r2', recommended: true, current: true, contactable: true }]
test('buyer shortlist enforces max five, duplicates, and request membership', () => {
  assert.equal(validateBuyerSelection({ requestId: 'r1', candidateIds: ['a'], candidates }), null)
  assert.match(validateBuyerSelection({ requestId: 'r1', candidateIds: ['a', 'a'], candidates }), /duplicate/)
  assert.match(validateBuyerSelection({ requestId: 'r1', candidateIds: ['b'], candidates }), /does not belong/)
  assert.match(validateBuyerSelection({ requestId: 'r1', candidateIds: [], candidates }), /one to five/)
})

test('research creates no outreach work until a buyer explicitly selects candidates', () => {
  assert.deepEqual(outreachJobsForSelection({ requestId: 'r1', candidateIds: [], candidates }), [])
  assert.deepEqual(outreachJobsForSelection({ requestId: 'r1', candidateIds: ['a'], candidates }), ['a'])
})
