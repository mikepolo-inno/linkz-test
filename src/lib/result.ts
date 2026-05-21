/**
 * Lightweight Result type for domain functions.
 *
 * Encodes success and failure as a discriminated union so callers must
 * handle the failure case before reading the success payload. This keeps
 * exceptions reserved for genuinely exceptional conditions (DB outage,
 * programmer errors) and turns expected business outcomes into values.
 */
export type Ok<T> = { ok: true; value: T };
export type Err<C extends string, D = undefined> = {
  ok: false;
  code: C;
  message: string;
  details?: D;
};
export type Result<T, C extends string, D = undefined> = Ok<T> | Err<C, D>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<C extends string, D = undefined>(
  code: C,
  message: string,
  details?: D,
): Err<C, D> {
  return { ok: false, code, message, details };
}
