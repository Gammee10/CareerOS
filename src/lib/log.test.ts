import { describe, expect, it, vi } from 'vitest';

import { logError, redact } from './log';

describe('redact', () => {
  it('removes a connection string, including the password', () => {
    const text =
      'failed to connect: postgresql://postgres.abc:sup3rsecret@db.example.com:5432/postgres';
    const safe = redact(text);

    expect(safe).not.toContain('sup3rsecret');
    expect(safe).toContain('postgresql://[redacted]');
  });

  it('removes libpq-style credentials and bearer tokens', () => {
    expect(redact('password=hunter2 host=db')).toBe('password=[redacted] host=db');
    expect(redact('authorization: Bearer abc.def.ghi')).toBe('authorization: Bearer [redacted]');
  });

  it('leaves ordinary text alone', () => {
    expect(redact('socket hang up')).toBe('socket hang up');
  });
});

describe('logError', () => {
  it('writes one JSON line and redacts credentials that arrive inside the cause', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logError('health_failed', new Error('bad: postgresql://u:p@host/db'), {
      code: 'dependency_unavailable',
    });

    const parsed = JSON.parse(String(spy.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(parsed.event).toBe('health_failed');
    expect(parsed.cause).not.toContain('postgresql://u:p');
    expect(parsed.cause).toContain('[redacted]');

    spy.mockRestore();
  });

  it('drops fields that could carry email content', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logError('ingest_failed', new Error('boom'), {
      subject: 'Interview invitation',
      snippet: 'Hi Jon, we would like to invite you…',
      route: '/api/ingest',
    });

    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).not.toContain('Interview invitation');
    expect(line).not.toContain('we would like to invite you');
    expect(line).toContain('/api/ingest');

    spy.mockRestore();
  });
});
