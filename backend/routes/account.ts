// Account routes — self-service account deletion (Section 9)
import express, { Router } from "express";
import { auth as firebaseAuth } from "../src/lib/firebase";
import { getAll, updateDoc } from "../src/lib/store";
import { cacheInvalidatePrefix } from "../src/lib/redisCache";
import { getAuthenticatedUser } from "../middleware/auth";
import rateLimitMiddleware from "../middleware/rateLimiter";
import { sendErrorResponse, UnauthorizedError } from "../helpers/errors";

const router = Router();

// Express 4 does not forward rejected async handlers to its error middleware.
const wrap = (handler: express.RequestHandler): express.RequestHandler => (req, res, next) => {
  try {
    const result = handler(req, res, next) as unknown;
    if (result && typeof (result as Promise<unknown>).catch === "function") {
      void (result as Promise<unknown>).catch(next);
    }
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/account/delete — permanently delete own account ───────────────
router.post("/api/account/delete", rateLimitMiddleware(5, 60_000), wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser?.id || authUser.role === "admin" || authUser.id === "admin-id" || authUser.id === "test-admin-id") {
    return sendErrorResponse(res, new UnauthorizedError("Sign in is required."));
  }

  const authUserId = authUser.id;

  const links = await getAll<{ auth_user_id: string }>("auth_profile_links");
  const link = links.find((l) => l.auth_user_id === authUserId) ?? null;

  if (!link) {
    await updateDoc("users", authUserId, { account_status: "deleted" });
    await updateDoc("requesters", authUserId, { account_status: "deleted" });
    await cacheInvalidatePrefix(`acct_deleted:${authUserId}`);
    return res.json({ ok: true, mode: "soft" });
  }

  try {
    await firebaseAuth.deleteUser(link.auth_user_id);
  } catch (error: any) {
    return sendErrorResponse(res, error, "Failed to delete account. Please try again later.");
  }

  await cacheInvalidatePrefix(`acct_deleted:${authUserId}`);
  return res.json({ ok: true, mode: "hard" });
}));

export default router;
