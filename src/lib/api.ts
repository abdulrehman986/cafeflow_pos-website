import { NextResponse } from "next/server";

/**
 * CafeFlow API response contract (consumed by the web app AND the Tauri POS):
 *
 * Success: { "success": true, "data": ... }
 * Error:   { "success": false, "error": { "code": "LICENSE_EXPIRED", "message": "..." } }
 */

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INVALID_CREDENTIALS"
  | "LICENSE_NOT_FOUND"
  | "LICENSE_EXPIRED"
  | "LICENSE_SUSPENDED"
  | "LICENSE_REVOKED"
  | "LICENSE_PENDING"
  | "DEVICE_LIMIT_REACHED"
  | "DEVICE_BLOCKED"
  | "DEVICE_NOT_FOUND"
  | "RESTAURANT_NOT_FOUND"
  | "CLIENT_SUSPENDED"
  | "DUPLICATE_RECORD"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INVALID_CREDENTIALS: 401,
  LICENSE_NOT_FOUND: 404,
  LICENSE_EXPIRED: 403,
  LICENSE_SUSPENDED: 403,
  LICENSE_REVOKED: 403,
  LICENSE_PENDING: 403,
  DEVICE_LIMIT_REACHED: 403,
  DEVICE_BLOCKED: 403,
  DEVICE_NOT_FOUND: 401,
  RESTAURANT_NOT_FOUND: 404,
  CLIENT_SUSPENDED: 403,
  DUPLICATE_RECORD: 409,
  INTERNAL_ERROR: 500,
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(code: ApiErrorCode, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(extra ? { details: extra } : {}),
      },
    },
    { status: STATUS_BY_CODE[code] ?? 400 }
  );
}

/** Wraps a route handler with uniform error handling — never leaks stack traces. */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err) {
      console.error("[api]", err);
      return fail("INTERNAL_ERROR", "An unexpected error occurred. Please try again.");
    }
  };
}
