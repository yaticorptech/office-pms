import mongoose from 'mongoose';
import { z } from 'zod';

export const objectId = z
  .string()
  .trim()
  .refine((value) => mongoose.isValidObjectId(value), { message: 'Invalid identifier' });

export const idParams = z.object({ id: objectId });

/**
 * Accepts an ISO date, a `yyyy-mm-dd` string, or an explicit empty value (→ null).
 *
 * A key the caller never sent stays `undefined` rather than becoming `null`, so a
 * partial update cannot silently clear a field it did not mention. Sending `null`
 * or `""` still clears it.
 */
export const optionalDate = z
  .union([z.string().trim(), z.date(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  })
  .refine((value) => value === undefined || value === null || value instanceof Date, {
    message: 'Invalid date',
  });

/** Same "omitted ≠ cleared" contract as `optionalDate`, for enum-backed fields. */
export const optionalEnum = (values, message = 'Select a valid option') =>
  z
    .union([z.string().trim(), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value === null || value === '' ? null : value;
    })
    .refine((value) => value === undefined || value === null || values.includes(value), {
      message,
    });

export const requiredDate = z
  .union([z.string().trim().min(1, 'Date is required'), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((value) => !Number.isNaN(value.getTime()), { message: 'Invalid date' });

export const paginationQuery = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

/** Treats "", "all" and undefined as "no filter applied". */
export const optionalFilter = (schema) =>
  z
    .union([schema, z.literal(''), z.literal('all')])
    .optional()
    .transform((value) => (value === '' || value === 'all' ? undefined : value));

export const booleanFlag = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0', ''])])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  });

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(160);
