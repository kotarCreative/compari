import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deploymentEnv,
  isRetryableHttpStatus,
  requireDeploymentEnv,
  retryAfterDelayMs,
} from './runtime.ts'

test('adapter runtime reads deployment configuration without provider coupling', () => {
  const name = 'COMPARI_RUNTIME_TEST_VALUE'
  const previous = process.env[name]
  process.env[name] = 'configured'
  try {
    assert.equal(deploymentEnv(name), 'configured')
    assert.equal(requireDeploymentEnv(name, 'missing'), 'configured')
  } finally {
    if (previous === undefined) delete process.env[name]
    else process.env[name] = previous
  }
})

test('adapter runtime centralizes retryable HTTP statuses', () => {
  assert.equal(isRetryableHttpStatus(408), true)
  assert.equal(isRetryableHttpStatus(429), true)
  assert.equal(isRetryableHttpStatus(503), true)
  assert.equal(isRetryableHttpStatus(422), false)
})

test('Firecrawl retry-after values become bounded millisecond delays', () => {
  const now = Date.parse('2026-09-06T00:00:00.000Z')
  assert.equal(retryAfterDelayMs('45', now), 45_000)
  assert.equal(retryAfterDelayMs('Sat, 06 Sep 2026 00:01:00 GMT', now), 60_000)
  assert.equal(retryAfterDelayMs('invalid', now), undefined)
  assert.equal(retryAfterDelayMs('600', now), 5 * 60_000)
})
