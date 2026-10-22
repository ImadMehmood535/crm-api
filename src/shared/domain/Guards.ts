import { ValidationFailedError } from '@shared/errors/AppError';

/** Trims; blank or too long throws a one-field ValidationFailedError. */
export function requiredText(value: string, field: string, label: string, max: number): string {
  const trimmed = (value ?? '').trim();
  if (trimmed.length === 0) throw ValidationFailedError.forField(field, `${label} is required.`);
  if (trimmed.length > max) {
    throw ValidationFailedError.forField(field, `${label} must be ${max} characters or fewer.`);
  }
  return trimmed;
}

/** null, undefined or blank become null; otherwise trimmed and length-checked. */
export function optionalText(
  value: string | null | undefined,
  field: string,
  label: string,
  max: number,
): string | null {
  if (value === null || value === undefined || value.trim().length === 0) return null;
  return requiredText(value, field, label, max);
}

/** Value must be one of the allowed options. */
export function oneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  field: string,
  label: string,
): T {
  if (!allowed.includes(value as T)) {
    throw ValidationFailedError.forField(field, `${label} must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}
