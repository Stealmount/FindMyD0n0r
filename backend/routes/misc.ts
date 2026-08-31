// Public misc routes — extracted from server.ts (Phase 3 decomposition, 3.6.8)
// Owns: blood-banks directory, voluntary camps, stats, leaderboard
import express, { Router } from "express";
import { getCollection as dbGetCollection, saveDoc as dbSaveDoc } from "../src/lib/serverDb";
import type { BloodRequest, DonationLog, User } from "../src/types";
import { sendErrorResponse } from "../helpers/errors";
import { getUpstash, k } from "../src/lib/upstash";

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

// ─── Blood Banks & Live Stock Directory (All-India Filtered & Paginated) ──────
router.get("/api/blood-banks", wrap(async (req, res) => {
  try {
    const { state, district, city, pincode, category, blood_type, component, q, sort, lat, lng, page, limit } = req.query;
    let bloodBanks = await dbGetCollection("blood_banks");

    if (!bloodBanks || bloodBanks.length === 0) {
      const { ALL_INDIA_SEED_BLOOD_BANKS } = await import("../../src/data/allIndiaBloodBankSeed");
      for (const bank of ALL_INDIA_SEED_BLOOD_BANKS) {
        await dbSaveDoc("blood_banks", bank.id, bank as any);
      }
      bloodBanks = ALL_INDIA_SEED_BLOOD_BANKS as any;
    }

    let filtered = bloodBanks as any[];

    if (state && String(state) !== 'ALL') {
      filtered = filtered.filter(b => b.state && String(b.state).toLowerCase() === String(state).toLowerCase());
    }
    if (district && String(district) !== 'ALL') {
      filtered = filtered.filter(b => b.district && String(b.district).toLowerCase() === String(district).toLowerCase());
    }
    if (city && String(city) !== 'ALL') {
      filtered = filtered.filter(b => b.city && String(b.city).toLowerCase().includes(String(city).toLowerCase()));
    }
    if (pincode) {
      filtered = filtered.filter(b => b.pincode && String(b.pincode).startsWith(String(pincode)));
    }
    if (category && String(category) !== 'ALL') {
      filtered = filtered.filter(b => b.category === String(category));
    }
    if (blood_type && String(blood_type) !== 'ALL') {
      filtered = filtered.filter(b => Array.isArray(b.stock) && b.stock.some((s: any) => s.blood_type === String(blood_type) && s.available_units > 0));
    }
    if (component && String(component) !== 'ALL') {
      filtered = filtered.filter(b => Array.isArray(b.stock) && b.stock.some((s: any) => s.component === String(component) && s.available_units > 0));
    }
    if (q) {
      const queryStr = String(q).toLowerCase();
      filtered = filtered.filter(b =>
        (b.name && b.name.toLowerCase().includes(queryStr)) ||
        (b.city && b.city.toLowerCase().includes(queryStr)) ||
        (b.district && b.district.toLowerCase().includes(queryStr)) ||
        (b.pincode && b.pincode.includes(queryStr)) ||
        (b.address && b.address.toLowerCase().includes(queryStr))
      );
    }

    // Geolocation sorting if requested
    if (sort === 'nearest' && lat && lng) {
      const userLat = Number(lat);
      const userLng = Number(lng);
      filtered.sort((a, b) => {
        const distA = Math.hypot((a.latitude || 0) - userLat, (a.longitude || 0) - userLng);
        const distB = Math.hypot((b.latitude || 0) - userLat, (b.longitude || 0) - userLng);
        return distA - distB;
      });
    } else {
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(String(page || 1), 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit || 50), 10)));
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedItems = filtered.slice(startIndex, startIndex + limitNum);

    return res.json({
      success: true,
      count: paginatedItems.length,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      total_pages: totalPages,
      blood_banks: paginatedItems
    });
  } catch (e: any) {
    return sendErrorResponse(res, e, "Failed to fetch blood banks directory.");
  }
}));

// ─── Voluntary Donation Camps (All-India Filtered & Paginated) ──────────────
router.get("/api/camps", wrap(async (req, res) => {
  try {
    const { state, district, city, pincode, status, q, page, limit } = req.query;
    let camps = await dbGetCollection("donation_camps");

    if (!camps || camps.length === 0) {
      const { ALL_INDIA_SEED_CAMPS } = await import("../../src/data/allIndiaBloodBankSeed");
      for (const camp of ALL_INDIA_SEED_CAMPS) {
        await dbSaveDoc("donation_camps", camp.id, camp as any);
      }
      camps = ALL_INDIA_SEED_CAMPS as any;
    }

    let filtered = camps as any[];

    if (state && String(state) !== 'ALL') {
      filtered = filtered.filter(c => c.state && String(c.state).toLowerCase() === String(state).toLowerCase());
    }
    if (district && String(district) !== 'ALL') {
      filtered = filtered.filter(c => c.district && String(c.district).toLowerCase() === String(district).toLowerCase());
    }
    if (city && String(city) !== 'ALL') {
      filtered = filtered.filter(c => c.city && String(c.city).toLowerCase().includes(String(city).toLowerCase()));
    }
    if (pincode) {
      filtered = filtered.filter(c => c.pincode && String(c.pincode).startsWith(String(pincode)));
    }
    if (status && String(status) !== 'ALL') {
      filtered = filtered.filter(c => c.status === String(status));
    }
    if (q) {
      const queryStr = String(q).toLowerCase();
      filtered = filtered.filter(c =>
        (c.title && c.title.toLowerCase().includes(queryStr)) ||
        (c.organizer_name && c.organizer_name.toLowerCase().includes(queryStr)) ||
        (c.city && c.city.toLowerCase().includes(queryStr)) ||
        (c.district && c.district.toLowerCase().includes(queryStr)) ||
        (c.venue_address && c.venue_address.toLowerCase().includes(queryStr))
      );
    }

    filtered.sort((a, b) => new Date(a.camp_date || 0).getTime() - new Date(b.camp_date || 0).getTime());

    const pageNum = Math.max(1, parseInt(String(page || 1), 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit || 25), 10)));
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedItems = filtered.slice(startIndex, startIndex + limitNum);

    return res.json({
      success: true,
      count: paginatedItems.length,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      total_pages: totalPages,
      camps: paginatedItems
    });
  } catch (e: any) {
    return sendErrorResponse(res, e, "Failed to fetch donation camps.");
  }
}));

// ─── Stats ──────────────────────────────────────────────────────────────────
router.get("/api/stats", wrap(async (_req, res) => {
  try {
    const [donors, reqs, logs] = await Promise.all([
      dbGetCollection<User>("users"),
      dbGetCollection<BloodRequest>("blood_requests"),
      dbGetCollection<DonationLog>("donation_log")
    ]);
    const totalDonors = donors.filter(u => u.blood_type).length;
    const activeRequests = reqs.filter(r => r.status === "open" || r.status === "matching" || r.status === "partially_matched").length;
    const livesSaved = logs.length * 3;
    const bloodGroupCounts: Record<string, number> = {};
    donors.forEach(d => {
      if (d.blood_type) bloodGroupCounts[d.blood_type] = (bloodGroupCounts[d.blood_type] || 0) + 1;
    });
    return res.json({ totalDonors, activeRequests, livesSaved, bloodGroupCounts });
  } catch {
    return res.json({ totalDonors: 0, activeRequests: 0, livesSaved: 0, bloodGroupCounts: {} });
  }
}));

// ─── Leaderboard ────────────────────────────────────────────────────────────
router.get("/api/leaderboard", wrap(async (req, res) => {
  const [donors, logs] = await Promise.all([
    dbGetCollection<User>("users"),
    dbGetCollection<DonationLog>("donation_log")
  ]);
  const counts = logs.reduce((acc, l) => (l.donor_id && (acc[l.donor_id] = (acc[l.donor_id] || 0) + 1), acc), {} as Record<string, number>);
  const list = donors.map(d => {
    const donation_count = counts[d.id] || 0;
    return { name: d.full_name, blood_group: d.blood_type, donation_count, city: d.city || "New Delhi" };
  }).filter(x => x.donation_count > 0).sort((a, b) => b.donation_count - a.donation_count).slice(0, 10);
  return res.json(list);
}));

// ─── Public donor count by pincodes (+ optional blood group) ─────────────────
// Privacy-preserving: count only, zero PII. Backed by the s:dprof:* index SETs
// maintained by the store layer. 60s in-process cache to absorb traffic spikes.
const donorCountCache = new Map<string, { count: number; at: number }>();
const DONOR_COUNT_TTL_MS = 60_000;

router.get("/api/donors/count", wrap(async (req, res) => {
  const pinsRaw = String(req.query.pins ?? "");
  const bg = String(req.query.bg ?? "").trim();
  const pins = Array.from(new Set(pinsRaw.split(",").map((p) => p.trim()).filter(Boolean))).slice(0, 100);
  if (pins.length === 0) return res.json({ count: 0 });

  const cacheKey = `${pins.join(",")}|${bg}`;
  const hit = donorCountCache.get(cacheKey);
  if (hit && Date.now() - hit.at < DONOR_COUNT_TTL_MS) {
    return res.json({ count: hit.count });
  }

  try {
    let ids: Set<string> | null = null;
    for (const pin of pins) {
      const members = await getUpstash().smembers(k(`s:dprof:pin:${pin}`));
      if (!ids) {
        ids = new Set(members as string[]);
      } else {
        for (const m of members) ids.add(String(m));
      }
    }
    if (bg && ids && ids.size > 0) {
      const bgMembers = new Set((await getUpstash().smembers(k(`s:dprof:bg:${bg}`))) as string[]);
      for (const id of Array.from(ids)) {
        if (!bgMembers.has(id)) ids.delete(id);
      }
    }

    // Only count donors that are actually available.
    let count = 0;
    if (ids && ids.size > 0) {
      const idList = Array.from(ids);
      const docs: unknown[] = [];
      for (let i = 0; i < idList.length; i += 100) {
        const raws = await getUpstash().mget(...idList.slice(i, i + 100).map((id) => k(`donor_profiles:${id}`)));
        docs.push(...raws);
      }
      for (const raw of docs) {
        try {
          const d = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (d && typeof d === "object" && (d as Record<string, unknown>).is_available !== false) count++;
        } catch { /* skip malformed */ }
      }
    }

    donorCountCache.set(cacheKey, { count, at: Date.now() });
    return res.json({ count });
  } catch (error) {
    console.error("[donors/count] error:", error);
    return res.json({ count: 0 });
  }
}));

export default router;
