// Zod validation middleware — Phase 7.1
// Shared validate() helper: parses req.body with a Zod schema, returns 400
// with structured { error, fields } on failure, else attaches parsed values.
import express, { Request, Response, NextFunction } from "express";
import { z, ZodError, ZodType } from "zod";

function formatFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

/**
 * Express middleware that validates req.body against a Zod schema.
 * On success, replaces req.body with the parsed (post-transform) value so
 * downstream handlers receive normalized + untrusted-field-stripped data.
 * On failure: 400 with `{ error, fields }`.
 *
 * ponytail: no per-route customization here; needs a stricter/whitelist mode,
 * add a `mode: "strip" | "strict"` option then.
 */
export function validate<T extends ZodType>(schema: T): express.RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed.",
        fields: formatFields(parsed.error),
      });
    }
    req.body = parsed.data;
    next();
  };
}

// Re-export helpers so route files can share enum constants.
export { z };
