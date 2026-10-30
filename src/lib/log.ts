/**
 * The only place allowed to write to the console.
 *
 * Structured, one JSON object per line (D6). It enforces the two rules that matter most here:
 * **email content never reaches a log**, and **credentials never reach a log** — even when they
 * arrive inside a library's error message, which is exactly how they usually leak.
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

/**
 * Connection strings and tokens can appear inside an error message we did not write — a driver
 * refusing a connection, for instance. Redact by shape rather than trusting the caller.
 */
export function redact(text: string): string {
  return text
    .replace(/\bpostgres(?:ql)?:\/\/\S+/gi, 'postgresql://[redacted]')
    .replace(/\b(password|pwd|token|secret|apikey|api_key)=\S+/gi, '$1=[redacted]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]');
}

function safeFields(fields: LogFields): LogFields {
  const safe: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) continue;
    if (value === undefined) continue;
    safe[key] = typeof value === 'string' ? redact(value) : value;
  }
  return safe;
}

export function logEvent(event: string, fields: LogFields = {}): void {
  console.log(JSON.stringify({ level: 'info', event, ...safeFields(fields) }));
}

export function logError(event: string, cause: unknown, fields: LogFields = {}): void {
  const raw = cause instanceof Error ? cause.message.slice(0, 300) : 'unknown error';
  console.error(
    JSON.stringify({ level: 'error', event, cause: redact(raw), ...safeFields(fields) }),
  );
}
