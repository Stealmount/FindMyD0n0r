// Dependency-neutral error module — owns the single ApiError definition.
// api.ts re-exports ApiError from here for backward import compatibility,
// and authToken.ts imports it directly. This keeps the dependency graph
// one-directional: errors.ts has no imports, so there is no cycle.

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown[];

  constructor(message: string, status: number = 500, code?: string, details?: unknown[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
