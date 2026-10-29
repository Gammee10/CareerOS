'use client';

import { useEffect, useState } from 'react';

/**
 * The walking skeleton's only screen.
 *
 * It does one thing: ask the API what time the database thinks it is, and show the answer. If it
 * cannot, it shows the error the API returned — never a blank page and never a made-up value.
 */

interface HealthPayload {
  ok: true;
  database: string;
  databaseTime: string;
  checkedAt: string;
}

interface ErrorPayload {
  error: { code: string; message: string };
}

type State =
  | { status: 'loading' }
  | { status: 'ok'; data: HealthPayload }
  | { status: 'failed'; message: string };

export default function HomePage() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        const body: unknown = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          const failure = body as ErrorPayload;
          setState({ status: 'failed', message: failure.error?.message ?? 'Unknown failure.' });
          return;
        }

        setState({ status: 'ok', data: body as HealthPayload });
      } catch {
        if (!cancelled) setState({ status: 'failed', message: 'Could not reach the API.' });
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem', lineHeight: 1.6 }}>
      <h1>CareerOS</h1>
      <p>Walking skeleton — proof that the browser, the API and the database are connected.</p>

      {state.status === 'loading' && <p>Checking the database…</p>}

      {state.status === 'failed' && (
        <p role="alert" style={{ color: '#b00020' }}>
          {state.message}
        </p>
      )}

      {state.status === 'ok' && (
        <dl>
          <dt>Database</dt>
          <dd>{state.data.database}</dd>
          <dt>Database clock</dt>
          <dd>
            <time dateTime={state.data.databaseTime}>{state.data.databaseTime}</time>
          </dd>
          <dt>Checked at</dt>
          <dd>
            <time dateTime={state.data.checkedAt}>{state.data.checkedAt}</time>
          </dd>
        </dl>
      )}
    </main>
  );
}
