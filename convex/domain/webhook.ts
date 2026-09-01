export type SvixHeaders = { id: string; timestamp: string; signature: string }
export type NormalizedAttachment = {
  id: string
  filename?: string
  contentType?: string
  size?: number
}
export type NormalizedInboundEvent = {
  eventType:
    | 'message.received'
    | 'message.delivered'
    | 'message.bounced'
    | 'message.complained'
    | 'message.rejected'
  eventId: string
  inboxId?: string
  threadId?: string
  messageId?: string
  sender?: string
  subject?: string
  body?: string
  attachments: Array<NormalizedAttachment>
  occurredAt?: number
}

export function readSvixHeaders(headers: {
  get: (name: string) => string | null
}): SvixHeaders | null {
  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signature = headers.get('svix-signature')
  return id && timestamp && signature ? { id, timestamp, signature } : null
}

export function isFreshSvixTimestamp(
  timestamp: string,
  nowMs: number,
  maxAgeMs = 5 * 60_000,
): boolean {
  if (!/^\d{10,13}$/.test(timestamp)) return false
  const raw = Number(timestamp)
  const at = timestamp.length === 10 ? raw * 1_000 : raw
  return Number.isSafeInteger(at) && Math.abs(nowMs - at) <= maxAgeMs
}

/** Verify the standard Svix HMAC envelope before parsing the untrusted body. */
export async function verifySvixSignature(
  rawBody: string,
  headers: SvixHeaders,
  secret: string,
): Promise<boolean> {
  const encodedSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret
  let secretBytes: Uint8Array
  try {
    secretBytes = decodeBase64(encodedSecret)
  } catch {
    return false
  }
  const key = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(secretBytes).buffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const payload = new TextEncoder().encode(
    `${headers.id}.${headers.timestamp}.${rawBody}`,
  )
  const expected = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, payload),
  )
  return headers.signature.split(' ').some((entry) => {
    const [version, signature] = entry.split(',', 2)
    if (version !== 'v1' || !signature) return false
    try {
      return equalBytes(expected, decodeBase64(signature))
    } catch {
      return false
    }
  })
}

/** Parse only after a real Svix verifier authenticated the raw body. */
export function normalizeVerifiedAgentMailEvent(
  value: unknown,
): NormalizedInboundEvent | null {
  if (!isRecord(value)) return null
  const eventType = typeof value.event_type === 'string' ? value.event_type : ''
  if (
    ![
      'message.received',
      'message.delivered',
      'message.bounced',
      'message.complained',
      'message.rejected',
    ].includes(eventType)
  )
    return null
  const eventId = typeof value.event_id === 'string' ? value.event_id : ''
  if (!eventId) return null
  const message = isRecord(value.message) ? value.message : {}
  const body = firstString(
    message.extracted_text,
    message.extracted_html,
    message.text,
    message.html,
  )
  const at =
    typeof message.created_at === 'string'
      ? Date.parse(message.created_at)
      : NaN
  return {
    eventType: eventType as NormalizedInboundEvent['eventType'],
    eventId,
    inboxId: stringOrUndefined(message.inbox_id),
    threadId: stringOrUndefined(message.thread_id),
    messageId: stringOrUndefined(message.message_id),
    sender: stringOrUndefined(message.from),
    subject: stringOrUndefined(message.subject),
    body: body?.slice(0, 40_000),
    attachments: Array.isArray(message.attachments)
      ? message.attachments.flatMap(normalizeAttachment).slice(0, 20)
      : [],
    occurredAt: Number.isFinite(at) ? at : undefined,
  }
}

function normalizeAttachment(value: unknown): Array<NormalizedAttachment> {
  if (!isRecord(value) || typeof value.attachment_id !== 'string') return []
  return [
    {
      id: value.attachment_id,
      filename: stringOrUndefined(value.filename)?.slice(0, 255),
      contentType: stringOrUndefined(value.content_type)?.slice(0, 120),
      size:
        typeof value.size === 'number' && value.size >= 0
          ? value.size
          : undefined,
    },
  ]
}
function firstString(...values: Array<unknown>): string | undefined {
  return values.find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )
}
function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1)
    difference |= left[index] ^ right[index]
  return difference === 0
}
