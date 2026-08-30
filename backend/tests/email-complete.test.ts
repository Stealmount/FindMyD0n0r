import "./setup-env";
import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, ChildProcess } from "node:child_process";

const PORT = process.env.TEST_PORT || "5006";
const BASE = process.env.TEST_BASE_URL || `http://localhost:${PORT}`;

// Contract tests for the Phase 2 unified-auth surface. These deliberately avoid
// external auth: in NODE_ENV=test the 401 path (no session) and the 403 path
// (invalid OTP ticket — validated before any profile/DB call) are deterministic.
// Positive create/link paths require a real backing store and are
// covered by manual verification via the running environment.
describe("Email-complete & unified auth (/api/auth/email-complete, /api/auth/me)", () => {
  let child: ChildProcess | null = null;

  before(async () => {
    const check = await fetch(`${BASE}/api/health`).catch(() => null);
    if (!check || !check.ok) {
      child = spawn(process.execPath, ["--import", "tsx", "backend/server.ts"], {
        stdio: "pipe",
        env: {
          ...process.env,
          PORT,
          NODE_ENV: "test",
        },
      });
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 250));
        const res = await fetch(`http://127.0.0.1:${PORT}/api/health`).catch(() => null);
        if (res && res.ok) break;
      }
    }
  });

  after(() => {
    if (child && child.pid) {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
      } else {
        child.kill();
      }
    }
  });

  test("GET /api/auth/me without sign-in returns 401 Unauthorized", async () => {
    const res = await fetch(`${BASE}/api/auth/me`);
    assert.equal(res.status, 401);
    const body = await res.json() as { error?: string };
    assert.equal(body.error, "Sign in is required.");
  });

  test("POST /api/auth/email-complete without sign-in (or an authenticated session) is reachable and validates the ticket", async () => {
    // No Authorization header → the route only needs the OTP ticket check; an
    // invalid/expired ticket must return 403 before any profile/DB work.
    const res = await fetch(`${BASE}/api/auth/email-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", verificationToken: "bogus-ticket" }),
    });
    assert.equal(res.status, 403, "Invalid email-OTP ticket must be rejected");
    const body = await res.json() as { error?: string };
    assert.match(body.error || "", /expired|new OTP/i);
  });

  test("POST /api/auth/email-complete rejects a malformed email before the ticket check", async () => {
    const res = await fetch(`${BASE}/api/auth/email-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", verificationToken: "x" }),
    });
    assert.equal(res.status, 400, "Malformed email must be rejected by validation");
  });

  test("POST /api/auth/email-complete requires a verification token", async () => {
    const res = await fetch(`${BASE}/api/auth/email-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com" }),
    });
    assert.equal(res.status, 400, "Missing verificationToken must be rejected");
  });

  test("POST /api/auth/complete-verification without sign-in returns 401 (unchanged contract)", async () => {
    const res = await fetch(`${BASE}/api/auth/complete-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "donor" }),
    });
    assert.equal(res.status, 401, "Google completion still requires a session");
  });
});
