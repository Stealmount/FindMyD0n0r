// Hospital routes — extracted from server.ts (Phase 3 decomposition, 3.6.8)
// Owns: /api/hospital/dashboard (active requests, matches, donors with PII gating)
import express, { Router } from "express";
import { getCollection as dbGetCollection } from "../src/lib/serverDb";
import { getAuthenticatedUser } from "../middleware/auth";
import { sendErrorResponse, UnauthorizedError, AppError } from "../helpers/errors";
import type { BloodRequest, Match, User } from "../src/types";

const router = Router();

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

router.get("/api/hospital/dashboard", wrap(async (req, res) => {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return sendErrorResponse(res, new UnauthorizedError("Unauthorized: Invalid or missing authentication token."));
  }

  const [allReqs, allMatches, allDonors] = await Promise.all([
    dbGetCollection<BloodRequest>("blood_requests"),
    dbGetCollection<Match>("matches"),
    dbGetCollection<User>("users")
  ]);

  const activeReqs = allReqs.filter(r => r.status !== "fulfilled" && r.status !== "cancelled");
  const activeReqIds = new Set(activeReqs.map(r => r.id));
  const activeMatches = allMatches.filter(m => activeReqIds.has(m.request_id));

  const approvedDonorIds = new Set(
    allMatches.filter(m => m.donor_response === "approved").map(m => m.donor_id)
  );

  const donors = allDonors.map(d => {
    const isApproved = approvedDonorIds.has(d.id);
    if (isApproved) {
      return {
        id: d.id,
        full_name: d.full_name,
        blood_type: d.blood_type,
        city: d.city,
        phone: d.phone,
        whatsapp_number: d.whatsapp_number
      } as User;
    } else {
      return {
        id: d.id,
        full_name: d.full_name,
        blood_type: d.blood_type,
        city: d.city
      } as User;
    }
  });

  return res.json({
    requests: activeReqs,
    matches: activeMatches,
    users: donors,
    donors: donors
  });
}));

// ─── POST /api/hospital/register — RETIRED (410 Gone) ─────────────────────────
// Legacy institution registration wrote the old schema (institution_name,
// institution_type, contact_person, status: "pending_verification") into the
// `institutions` collection — rows admins could neither see nor act on under
// the Rev 3 flow. Institutional accounts now register through
// POST /api/institutions/register. 410 keeps old clients / deep links from
// silently polluting the institutions collection.
router.post("/register", wrap((_req, res) => {
  return sendErrorResponse(res, new AppError(
    "This endpoint is retired. Register through POST /api/institutions/register instead.",
    410,
    "LEGACY_ENDPOINT"
  ));
}));

export default router;
