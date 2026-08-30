import assert from 'node:assert/strict'
import test from 'node:test'
import { canClaimJob, canRetryJob, retryDelayMs } from './sideEffectPolicy.ts'

test('job lease claim accepts pending, retryable, and expired leases only', () => {
  assert.equal(canClaimJob({ status: 'pending' }, 100), true)
  assert.equal(canClaimJob({ status: 'retryable_failure' }, 100), true)
  assert.equal(canClaimJob({ status: 'running', leaseExpiresAt: 99 }, 100), true)
  assert.equal(canClaimJob({ status: 'running', leaseExpiresAt: 101 }, 100), false)
  assert.equal(canClaimJob({ status: 'succeeded' }, 100), false)
})

test('retry policy is bounded and has deterministic exponential backoff', () => {
  assert.equal(retryDelayMs(1), 1_000)
  assert.equal(retryDelayMs(3), 4_000)
  assert.equal(retryDelayMs(99), 32_000)
  assert.equal(canRetryJob({ retryable: true, attemptCount: 2, maxAttempts: 3 }), true)
  assert.equal(canRetryJob({ retryable: true, attemptCount: 3, maxAttempts: 3 }), false)
  assert.equal(canRetryJob({ retryable: false, attemptCount: 1 }), false)
})
