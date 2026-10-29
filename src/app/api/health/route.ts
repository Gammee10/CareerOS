import { dependencyUnavailable, internalError } from '@/lib/errors';
import { getSql } from '@/lib/db';
import { buildHealthPayload, type HealthRow } from '@/lib/health';
import { logError } from '@/lib/log';

// Never cached, never prerendered: this route exists to prove a live path to the database, and a
// build-time render would either fail without a connection string or cache yesterday's answer.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const sql = getSql();
    const rows = await sql<HealthRow[]>`
      select now() as now, current_database() as database
    `;

    const row = rows[0];
    if (!row) {
      const error = internalError('The database returned no rows.');
      return Response.json(error.toPayload(), { status: error.status });
    }

    return Response.json(buildHealthPayload(row, new Date()));
  } catch (cause) {
    // A dependency failure is not our bug. Say which dependency and promise nothing changed; the
    // logger drops anything that looks like email content and never records the connection string.
    const error = dependencyUnavailable('The database');
    logError('health_failed', cause, { code: error.code });
    return Response.json(error.toPayload(), { status: error.status });
  }
}
