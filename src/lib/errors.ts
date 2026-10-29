/**
 * The single error shape used by every route (D5 §4).
 *
 * Codes map to HTTP statuses in one place so a route never invents a status, and the payload shape
 * is identical everywhere so the client has one way to read a failure.
 */

export const ERROR_STATUS = {
  invalid_input: 400,
  unauthenticated: 401,
  not_found: 404,
  conflict: 409,
  internal: 500,
  dependency_unavailable: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export interface ErrorPayload {
  error: {
    code: ErrorCode;
    message: string;
    field?: string;
  };
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly field: string | undefined;

  constructor(code: ErrorCode, message: string, options: { field?: string } = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.field = options.field;
  }

  /** HTTP status for this error, derived — never passed in by callers. */
  get status(): number {
    return ERROR_STATUS[this.code];
  }

  toPayload(): ErrorPayload {
    const payload: ErrorPayload = { error: { code: this.code, message: this.message } };
    if (this.field !== undefined) {
      payload.error.field = this.field;
    }
    return payload;
  }
}

/**
 * The default for an unexpected failure. The message is deliberately reassuring and truthful:
 * a 500 from a write path means the transaction rolled back.
 */
export function internalError(message = 'Something went wrong. Nothing was changed.'): AppError {
  return new AppError('internal', message);
}

/** A dependency (Gmail, database) is unreachable — distinct from our own bug. */
export function dependencyUnavailable(dependency: string): AppError {
  return new AppError(
    'dependency_unavailable',
    `${dependency} is unavailable. Nothing was changed.`,
  );
}
