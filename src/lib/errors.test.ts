import { describe, expect, it } from 'vitest';

import { AppError, dependencyUnavailable, ERROR_STATUS, internalError } from './errors';

describe('AppError', () => {
  it('derives the HTTP status from the code, never from the caller', () => {
    expect(new AppError('not_found', 'nope').status).toBe(404);
    expect(new AppError('conflict', 'already done').status).toBe(409);
    expect(new AppError('invalid_input', 'bad date').status).toBe(400);
  });

  it('serialises to the single payload shape used by every route', () => {
    const payload = new AppError('invalid_input', 'That date cannot be parsed.', {
      field: 'due_date',
    }).toPayload();

    expect(payload).toEqual({
      error: {
        code: 'invalid_input',
        message: 'That date cannot be parsed.',
        field: 'due_date',
      },
    });
  });

  it('omits the field when there is none', () => {
    const payload = new AppError('conflict', 'Already done.').toPayload();
    expect(payload.error).not.toHaveProperty('field');
  });

  it('is a real Error, so it can be thrown', () => {
    const error = new AppError('internal', 'boom');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
  });

  it('maps every code to a status — no code can be added without one', () => {
    for (const [code, status] of Object.entries(ERROR_STATUS)) {
      expect(new AppError(code as keyof typeof ERROR_STATUS, 'x').status).toBe(status);
    }
  });
});

describe('helpers', () => {
  it('internalError is a 500 that promises nothing changed', () => {
    const error = internalError();
    expect(error.status).toBe(500);
    expect(error.message).toMatch(/nothing was changed/i);
  });

  it('dependencyUnavailable names the dependency and is retryable by the caller', () => {
    const error = dependencyUnavailable('Gmail');
    expect(error.status).toBe(503);
    expect(error.message).toContain('Gmail');
  });
});
