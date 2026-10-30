import { describe, expect, it, vi } from 'vitest';

const { getSqlMock } = vi.hoisted(() => ({ getSqlMock: vi.fn() }));

vi.mock('@/lib/db', () => ({ getSql: getSqlMock }));

import { GET } from './route';

function sqlTagReturning(value: unknown) {
  return vi.fn().mockResolvedValue(value);
}

describe('GET /api/health', () => {
  it('returns the database clock when the database answers', async () => {
    getSqlMock.mockReturnValue(
      sqlTagReturning([{ now: new Date('2026-10-30T10:00:00.000Z'), database: 'postgres' }]),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      database: 'postgres',
      databaseTime: '2026-10-30T10:00:00.000Z',
    });
  });

  it('returns 503 with the standard payload when the database is unreachable', async () => {
    getSqlMock.mockReturnValue(
      vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:5432')),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: {
        code: 'dependency_unavailable',
        message: expect.stringContaining('database') as unknown as string,
      },
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it('never puts a connection string in the response, even when the driver echoes one', async () => {
    const secretUrl =
      'postgresql://postgres.abc:sup3rsecret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';
    getSqlMock.mockReturnValue(
      vi.fn().mockRejectedValue(new Error(`bad connection: ${secretUrl}`)),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET();
    const body = JSON.stringify(await response.json());
    const logged = String(errorSpy.mock.calls[0]?.[0] ?? '');

    expect(body).not.toContain('sup3rsecret');
    expect(body).not.toContain('postgresql://');
    // The log line is the other place a credential could escape.
    expect(logged).not.toContain('sup3rsecret');
    expect(logged).not.toContain('postgresql://postgres');
    expect(logged).toContain('dependency_unavailable');

    errorSpy.mockRestore();
  });

  it('logs exactly one structured line per failure', async () => {
    getSqlMock.mockReturnValue(vi.fn().mockRejectedValue(new Error('socket hang up')));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await GET();

    const line = String(errorSpy.mock.calls[0]?.[0] ?? '');
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.level).toBe('error');
    expect(parsed.event).toBe('health_failed');
    expect(parsed.code).toBe('dependency_unavailable');

    errorSpy.mockRestore();
  });
});
