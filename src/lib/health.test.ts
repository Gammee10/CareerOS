import { describe, expect, it } from 'vitest';

import { buildHealthPayload } from './health';

const checkedAt = new Date('2026-10-30T00:00:00.000Z');

describe('buildHealthPayload', () => {
  it('returns the database name and its clock, not the web server’s', () => {
    const payload = buildHealthPayload(
      { now: new Date('2026-10-29T23:59:58.000Z'), database: 'postgres' },
      checkedAt,
    );

    expect(payload).toEqual({
      ok: true,
      database: 'postgres',
      databaseTime: '2026-10-29T23:59:58.000Z',
      checkedAt: '2026-10-30T00:00:00.000Z',
      commit: null,
    });
  });

  it('reports the deployed commit when the platform provides one', () => {
    const payload = buildHealthPayload(
      { now: new Date(1_000), database: 'postgres' },
      checkedAt,
      'abcdef1234567890',
    );
    expect(payload.commit).toBe('abcdef1234567890');
  });

  it('keeps the two timestamps distinct, so a client can tell them apart', () => {
    const payload = buildHealthPayload({ now: new Date(1_000), database: 'postgres' }, checkedAt);
    expect(payload.databaseTime).not.toBe(payload.checkedAt);
  });

  it('rejects a row without a usable timestamp', () => {
    expect(() =>
      buildHealthPayload({ now: new Date('nonsense'), database: 'postgres' }, checkedAt),
    ).toThrow(/invalid timestamp/);
  });

  it('rejects a row without a database name, rather than rendering a blank', () => {
    expect(() => buildHealthPayload({ now: new Date(), database: '' }, checkedAt)).toThrow(
      /database name is missing/,
    );
  });
});
