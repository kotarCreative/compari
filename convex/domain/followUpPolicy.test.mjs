import assert from 'node:assert/strict'
import test from 'node:test'
import { canProcessFollowUp, followUpIdempotencyKey } from './followUpPolicy.ts'

test('follow-up jobs are stable and reject a cross-request or stale lease', () => {
  assert.equal(followUpIdempotencyKey('q1'), 'follow-up:q1:v1')
  assert.equal(canProcessFollowUp({ jobKind: 'send_follow_up', jobQuestionId: 'q1', questionId: 'q1', jobRequestId: 'r1', questionRequestId: 'r1', jobCandidateId: 'c1', questionCandidateId: 'c1', status: 'running', claimMatches: true, questionStatus: 'answered' }), true)
  assert.equal(canProcessFollowUp({ jobKind: 'send_follow_up', jobQuestionId: 'q1', questionId: 'q1', jobRequestId: 'r2', questionRequestId: 'r1', jobCandidateId: 'c1', questionCandidateId: 'c1', status: 'running', claimMatches: true, questionStatus: 'answered' }), false)
})
