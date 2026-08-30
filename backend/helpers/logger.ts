// Structured JSON-line logger — Phase 5.4 (proof of concept).
// Outputs { timestamp, level, message, requestId?, ...extra } as one JSON line
// per entry on stdout so logs are machine-parseable (PM2, Loki, etc.).
//
// requestId is pulled from the AsyncLocalStorage requestContext set by the
// x-request-id middleware in middleware/security.ts.
//
// NOTE: only a few sites are migrated to this logger (PoC). Full migration of
// console.log/error is a separate follow-up phase.
import { requestContext } from "../middleware/security";

type Level = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: Level;
  message: string;
  requestId?: string;
  [key: string]: unknown;
}

function write(level: Level, message: string, extra?: Record<string, unknown>) {
  const entry: LogEntry = { timestamp: new Date().toISOString(), level, message };

  const store = requestContext.getStore();
  if (store?.requestId) entry.requestId = store.requestId.slice(0, 8);

  if (extra) {
    for (const [k, v] of Object.entries(extra)) entry[k] = v;
  }

  // JSON.stringify is safe here (single line, no multiline artifacts in PM2).
  const line = JSON.stringify(entry);
  if (level === "error") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

export const log = {
  info: (message: string, extra?: Record<string, unknown>) => write("info", message, extra),
  warn: (message: string, extra?: Record<string, unknown>) => write("warn", message, extra),
  error: (message: string, extra?: Record<string, unknown>) => write("error", message, extra),
};
