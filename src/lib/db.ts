/**
 * One Postgres client for the whole server process.
 *
 * Created lazily: `next build` imports this module, and it must not need a connection string at
 * build time. The first request that actually uses the database creates the client.
 */

import postgres from 'postgres';

import { databaseUrl } from './env';

export type Sql = ReturnType<typeof postgres>;

let client: Sql | undefined;

export function getSql(): Sql {
  if (!client) {
    client = postgres(databaseUrl(), {
      ssl: 'require',
      // Serverless: one short-lived connection per instance is plenty. A pool of ten would exhaust
      // the pooler's limits and buy nothing at this traffic.
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return client;
}
