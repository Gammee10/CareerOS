import { describe, expect, it } from 'vitest';

import { ConfigError, parseConfig } from './env';

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abcdefgh.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  DATABASE_URL: 'postgresql://postgres.abc:pw@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
  MAIL_IMAP_USER: 'careeros@example.com',
  MAIL_IMAP_PASSWORD: 'imap-app-password',
  MAIL_SMTP_USER: 'careeros@example.com',
  MAIL_SMTP_PASSWORD: 'smtp-app-password',
  CRON_SECRET: 'a'.repeat(32),
};

describe('parseConfig', () => {
  it('accepts a complete, valid environment', () => {
    const { public: pub, server } = parseConfig(valid);
    expect(pub.NEXT_PUBLIC_SUPABASE_URL).toBe('https://abcdefgh.supabase.co');
    expect(server.MAIL_IMAP_USER).toBe('careeros@example.com');
  });

  it('reports every missing variable at once, not one per restart', () => {
    const { CRON_SECRET: _cron, ...withoutCron } = valid;
    const { DATABASE_URL: _db, ...withoutBoth } = withoutCron;

    try {
      parseConfig({ ...withoutBoth, MAIL_IMAP_USER: 'not-an-email' });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const problems = (error as ConfigError).problems.join('\n');
      expect(problems).toContain('CRON_SECRET');
      expect(problems).toContain('DATABASE_URL');
      expect(problems).toContain('MAIL_IMAP_USER');
    }
  });

  it('refuses a CRON_SECRET that is too short to guard a mailbox', () => {
    expect(() => parseConfig({ ...valid, CRON_SECRET: 'short' })).toThrow(/at least 32/);
  });

  it('refuses a database URL that is not Postgres', () => {
    expect(() => parseConfig({ ...valid, DATABASE_URL: 'mysql://nope' })).toThrow(/postgres:\/\//);
  });

  it('refuses a Supabase URL that is not a URL', () => {
    expect(() => parseConfig({ ...valid, NEXT_PUBLIC_SUPABASE_URL: 'supabase' })).toThrow(
      /full URL/,
    );
  });

  it('treats the kill switches as optional and strictly boolean', () => {
    const withoutFlags = parseConfig(valid);
    expect(withoutFlags.server.INGEST_PAUSED).toBeUndefined();

    const paused = parseConfig({ ...valid, INGEST_PAUSED: 'true' });
    expect(paused.server.INGEST_PAUSED).toBe('true');

    expect(() => parseConfig({ ...valid, INGEST_PAUSED: 'yes' })).toThrow(/INGEST_PAUSED/);
  });
});
