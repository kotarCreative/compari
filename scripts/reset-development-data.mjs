#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AgentMailClient } from 'agentmail'

const POD_NAME = 'demo'
const args = new Set(process.argv.slice(2))
const execute = args.has('--execute')
const deployment = optionValue('--deployment') ?? 'dev'
const confirmation = optionValue('--confirm')
const expectedConfirmation = `RESET ${deployment} ${POD_NAME}`

if (deployment !== 'dev' && !deployment.startsWith('dev:')) {
  fail(
    `Refusing deployment ${JSON.stringify(deployment)}. This helper only accepts "dev" or an explicit "dev:<name>" deployment.`,
  )
}

const apiKey = process.env.AGENTMAIL_API_KEY
if (!apiKey) fail('AGENTMAIL_API_KEY is required to inspect AgentMail inboxes.')

console.log(`Convex target: ${deployment} (development)`)
console.log(`AgentMail target: pod named ${JSON.stringify(POD_NAME)}`)

const tables = listConvexTables(deployment)
const client = new AgentMailClient({ apiKey, maxRetries: 2 })
const pod = await findExactlyOnePod(client, POD_NAME)
const inboxes = await listPodInboxes(client, pod.podId)

console.log(`\nConvex tables to clear (${tables.length}):`)
for (const table of tables) console.log(`  - ${table}`)
console.log(`\nAgentMail inboxes to delete (${inboxes.length}):`)
for (const inbox of inboxes)
  console.log(`  - ${inbox.email} (${inbox.inboxId})`)

if (!execute) {
  console.log('\nDry run only; nothing was deleted.')
  console.log(
    `To execute: npm run reset:dev -- --execute --confirm ${JSON.stringify(expectedConfirmation)}`,
  )
  process.exit(0)
}

if (confirmation !== expectedConfirmation) {
  fail(
    `Confirmation did not match. Pass --confirm ${JSON.stringify(expectedConfirmation)} after reviewing the dry run.`,
  )
}

clearConvexDatabase(deployment, tables)
console.log(`Cleared ${tables.length} Convex tables.`)

for (const inbox of inboxes) {
  await client.pods.inboxes.delete(pod.podId, inbox.inboxId)
  console.log(`Deleted AgentMail inbox ${inbox.email} (${inbox.inboxId}).`)
}

console.log(
  `Reset complete: cleared Convex ${deployment} and deleted ${inboxes.length} inboxes from AgentMail pod ${JSON.stringify(POD_NAME)}.`,
)

function optionValue(name) {
  const argv = process.argv.slice(2)
  const index = argv.indexOf(name)
  if (index === -1) return undefined
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`)
  return value
}

function listConvexTables(target) {
  const output = run('npx', [
    'convex',
    'data',
    '--deployment',
    target,
    '--format',
    'json',
    '--limit',
    '1',
  ])
  const tables = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!tables.length)
    fail('Convex returned no tables; refusing an ambiguous reset.')
  if (tables.some((table) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(table)))
    fail('Convex returned an unexpected table name; refusing the reset.')
  return tables
}

async function findExactlyOnePod(agentMail, name) {
  const matches = []
  let pageToken
  do {
    const page = await agentMail.pods.list({
      limit: 100,
      ...(pageToken ? { pageToken } : {}),
    })
    matches.push(
      ...page.pods.filter(
        (pod) => pod.name.trim().toLowerCase() === name.toLowerCase(),
      ),
    )
    pageToken = page.nextPageToken
  } while (pageToken)
  if (matches.length !== 1)
    fail(
      `Expected exactly one AgentMail pod named ${JSON.stringify(name)}, found ${matches.length}.`,
    )
  return matches[0]
}

async function listPodInboxes(agentMail, podId) {
  const inboxes = []
  let pageToken
  do {
    const page = await agentMail.pods.inboxes.list(podId, {
      limit: 100,
      ...(pageToken ? { pageToken } : {}),
    })
    inboxes.push(...page.inboxes)
    pageToken = page.nextPageToken
  } while (pageToken)
  return inboxes
}

function clearConvexDatabase(target, tables) {
  const resetDirectory = mkdtempSync(join(tmpdir(), 'compari-reset-'))
  try {
    const snapshotDirectory = join(resetDirectory, 'snapshot')
    mkdirSync(snapshotDirectory)
    for (const table of tables) {
      const tableDirectory = join(snapshotDirectory, table)
      mkdirSync(tableDirectory)
      writeFileSync(join(tableDirectory, 'documents.jsonl'), '')
    }
    const snapshot = join(resetDirectory, 'empty-snapshot.zip')
    run('zip', ['-q', '-r', snapshot, '.'], { cwd: snapshotDirectory })
    run(
      'npx',
      [
        'convex',
        'import',
        snapshot,
        '--replace-all',
        '--yes',
        '--deployment',
        target,
      ],
      { stdio: 'inherit' },
    )
  } finally {
    if (resetDirectory.startsWith(join(tmpdir(), 'compari-reset-')))
      rmSync(resetDirectory, { recursive: true, force: true })
  }
}

function run(command, commandArgs, options = {}) {
  try {
    return execFileSync(command, commandArgs, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'inherit'],
      ...options,
    })
  } catch (error) {
    fail(`${command} failed with exit code ${error.status ?? 'unknown'}.`)
  }
}

function fail(message) {
  console.error(`Reset aborted: ${message}`)
  process.exit(1)
}
