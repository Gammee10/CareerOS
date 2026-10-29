/**
 * The only place allowed to write to the console.
 *
 * Structured, one JSON object per line (D6). It also enforces the rule that matters most here:
 * **email content never reaches a log**. Fields that look like mail content are dropped rather than
 * trusted to the caller, because the caller is often me.
 */

type FieldValue = string | number | boolean | undefined;
export type LogFields = Record<string, FieldValue>;

const FORBIDDEN_KEYS = new Set([
  'subject',
  'body',
  'snippet',
  'raw',
  'raw_body',
  'from',
  'to',
  'cc',
  'bcc',
  'content',
  'html',
  'text',
]);

function safeFields(fields: LogFields): LogFields {
  const safe: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) continue;
    if (value === undefined) continue;
    safe[key] = value;
  }
  return safe;
}

export function logEvent(event: string, fields: LogFields = {}): void {
  console.log(JSON.stringify({ level: 'info', event, ...safeFields(fields) }));
}

export function logError(event: string, cause: unknown, fields: LogFields = {}): void {
  const message = cause instanceof Error ? cause.message.slice(0, 200) : 'unknown error';
  console.error(JSON.stringify({ level: 'error', event, cause: message, ...safeFields(fields) }));
}
