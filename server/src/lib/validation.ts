// Parses request input with Zod or fails with a named 400.
import { z } from 'zod';
import { AppError } from './errors.js';
export function parseOrThrow<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown,
  label: string,
): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw AppError.badRequest(`Invalid ${label}`, {
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join('.') || label,
      message: issue.message,
    })),
  });
}
export const csvIds = z
  .string()
  .optional()
  .transform((value) => {
    if (!value) return [] as number[];
    const ids = value
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((id) => Number.isInteger(id) && id > 0);
    return Array.from(new Set(ids)).slice(0, 10);
  });
export const positiveInt = (fallback: number, max: number) =>
  z.coerce.number().int().min(1).max(max).catch(fallback).default(fallback);
export const movieIdParam = z.object({
  id: z.coerce.number().int().positive().max(100_000_000),
});
