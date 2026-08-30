import type express from "express";
import { log } from "./logger";

export interface ApiErrorPayload {
  error: string;
  code: string;
  message: string;
  details?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input data.", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required.", details?: unknown) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied.", details?: unknown) {
    super(message, 403, "FORBIDDEN", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Requested resource not found.", details?: unknown) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please try again later.", details?: unknown) {
    super(message, 429, "RATE_LIMITED", details);
  }
}

export class DatabaseError extends AppError {
  constructor(message = "A database error occurred. Please try again.", details?: unknown) {
    super(message, 500, "DATABASE_ERROR", details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service is temporarily unavailable. Please try again shortly.", details?: unknown) {
    super(message, 503, "SERVICE_UNAVAILABLE", details);
  }
}

export function sanitizeErrorMessage(msg: string, fallback: string): string {
  if (!msg) return fallback;

  // Filter out sensitive implementation details: credentials, connection strings, SQL queries, stack traces, internal paths
  const sensitivePatterns = [
    /postgres:\/\//i,
    /supabase_service_role_key/i,
    /admin_auth_secret/i,
    /resend_api_key/i,
    /waha_api_key/i,
    /at\s+.*:\d+:\d+/i,
    /syntax error/i,
    /\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b/i,
    /relation\s+".*"\s+does not exist/i,
    /column\s+".*"\s+does not exist/i,
    /ECONNREFUSED/i,
    /ENOTFOUND/i,
    /ETIMEDOUT/i,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(msg)) {
      return fallback;
    }
  }

  return msg;
}

export function logErrorToBackend(err: unknown, context: { statusCode: number; code: string; clientMessage: string }) {
  const errObj = err instanceof Error ? err : new Error(String(err));
  const rawMsg = errObj.message || "Unknown error";
  const safeLogMsg = rawMsg.replace(/(key|token|secret|password|auth|bearer)=[^&\s]+/gi, "$1=[REDACTED]");

  // 4xx responses are routine (logged-out session checks, bad input, not-found)
  // — log them compactly at warn without a stack. Only 5xx get full treatment.
  if (context.statusCode < 500) {
    log.warn(`[API] ${context.code} (${context.statusCode}): ${safeLogMsg}`, {
      statusCode: context.statusCode,
      code: context.code,
    });
    return;
  }

  log.error(`[API Error] ${context.code} (${context.statusCode}): ${safeLogMsg}`, {
    statusCode: context.statusCode,
    code: context.code,
    stack: errObj.stack,
    isAppError: err instanceof AppError,
  });
}

export function sendErrorResponse(
  res: express.Response,
  err: unknown,
  defaultMessage = "An unexpected server error occurred.",
  defaultStatusCode = 500,
  defaultCode = "INTERNAL_SERVER_ERROR"
) {
  let statusCode = defaultStatusCode;
  let code = defaultCode;
  let clientMessage = defaultMessage;
  let details: unknown = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    clientMessage = err.message;
    details = err.details;
  } else if (err && typeof err === "object") {
    const errorObj = err as any;
    if (typeof errorObj.statusCode === "number") statusCode = errorObj.statusCode;
    else if (typeof errorObj.status === "number") statusCode = errorObj.status;

    if (typeof errorObj.code === "string" && errorObj.code.length > 0 && !errorObj.code.startsWith("P")) {
      code = errorObj.code;
    }

    if (errorObj.name === "ZodError" || Array.isArray(errorObj.issues)) {
      statusCode = 400;
      code = "VALIDATION_ERROR";
      clientMessage = errorObj.issues?.[0]?.message || "Invalid input data.";
      details = errorObj.issues;
    } else if (typeof errorObj.message === "string" && errorObj.message.length > 0) {
      const sanitized = sanitizeErrorMessage(errorObj.message, defaultMessage);
      if (sanitized !== defaultMessage) {
        clientMessage = sanitized;
      }
    }
  } else if (typeof err === "string" && err.length > 0) {
    clientMessage = sanitizeErrorMessage(err, defaultMessage);
  }

  logErrorToBackend(err, { statusCode, code, clientMessage });

  const payload: ApiErrorPayload = {
    error: clientMessage,
    code,
    message: clientMessage,
    ...(details !== undefined ? { details } : {}),
  };

  return res.status(statusCode).json(payload);
}
