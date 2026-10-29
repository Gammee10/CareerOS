/**
 * The shape the health endpoint returns, built by a pure function so it can be tested without a
 * database. The route stays a thin wire: query, map, respond.
 */

export interface HealthRow {
  /** The database's own clock. */
  now: Date;
  /** The database name, as Postgres reports it. */
  database: string;
}

export interface HealthPayload {
  ok: true;
  /** Proof the value came from the database, not from the web server. */
  database: string;
  databaseTime: string;
  checkedAt: string;
}

export function buildHealthPayload(row: HealthRow, checkedAt: Date): HealthPayload {
  if (!(row.now instanceof Date) || Number.isNaN(row.now.getTime())) {
    throw new TypeError('health: database returned an invalid timestamp');
  }
  if (typeof row.database !== 'string' || row.database.length === 0) {
    throw new TypeError('health: database name is missing');
  }

  return {
    ok: true,
    database: row.database,
    databaseTime: row.now.toISOString(),
    checkedAt: checkedAt.toISOString(),
  };
}
