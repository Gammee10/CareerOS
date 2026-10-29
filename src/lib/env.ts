/**
 * One place that reads and validates configuration.
 *
 * Two rules, both from the design:
 *   1. A missing secret must fail **at startup with a readable message**, not halfway through an
 *      ingest run with `undefined` in a connection string (D6, RB1/RB2).
 *   2. Public and server-only values are separated by *type*, so a server secret cannot be
 *      imported into a client component by accident.
 */

import { z } from 'zod';

const nonEmpty = z.string().min(1, 'must not be empty');

/** Values that are safe to expose to the browser (Next.js inlines `NEXT_PUBLIC_*`). */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('must be a full URL, e.g. https://xyz.supabase.co'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty,
});

/** Values that must never reach the browser or a log line. */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty,
  DATABASE_URL: z.string().min(1).startsWith('postgres', 'must be a postgres:// connection string'),

  MAIL_IMAP_USER: z.string().email('must be an email address'),
  MAIL_IMAP_PASSWORD: nonEmpty,
  MAIL_SMTP_USER: z.string().email('must be an email address'),
  MAIL_SMTP_PASSWORD: nonEmpty,

  CRON_SECRET: z.string().min(32, 'must be at least 32 characters — it guards a mailbox'),

  // Optional kill switches; absent means "not paused".
  INGEST_PAUSED: z.enum(['true', 'false']).optional(),
  DIGEST_PAUSED: z.enum(['true', 'false']).optional(),
});

export type PublicConfig = z.infer<typeof publicSchema>;
export type ServerConfig = z.infer<typeof serverSchema>;

export class ConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Invalid configuration:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.') || '(root)';
    return `${path}: ${issue.message}`;
  });
}

/**
 * Parse the environment. Throws a `ConfigError` listing every problem at once — fixing one variable
 * per restart is a miserable way to start the day.
 */
export function parseConfig(source: Record<string, string | undefined>): {
  public: PublicConfig;
  server: ServerConfig;
} {
  const publicResult = publicSchema.safeParse(source);
  const serverResult = serverSchema.safeParse(source);

  const problems = [
    ...(publicResult.success ? [] : formatIssues(publicResult.error)),
    ...(serverResult.success ? [] : formatIssues(serverResult.error)),
  ];

  if (!publicResult.success || !serverResult.success) {
    throw new ConfigError(problems);
  }

  return { public: publicResult.data, server: serverResult.data };
}

/** Server-side configuration. Call this from server code only. */
export function serverConfig(): ServerConfig {
  return parseConfig(process.env).server;
}

/** Browser-safe configuration. */
export function publicConfig(): PublicConfig {
  return parseConfig(process.env).public;
}

/**
 * The database connection string alone.
 *
 * The walking skeleton must be able to read a clock without also having the mailbox credentials
 * configured. Narrow accessors are how a module asks for exactly what it needs — and how the
 * skeleton can deploy before the mail secrets exist.
 */
const databaseSchema = z.object({
  DATABASE_URL: z.string().min(1).startsWith('postgres', 'must be a postgres:// connection string'),
});

export function databaseUrl(): string {
  const result = databaseSchema.safeParse(process.env);
  if (!result.success) {
    throw new ConfigError(formatIssues(result.error));
  }
  return result.data.DATABASE_URL;
}
