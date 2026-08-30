// Health & cache stats routes — instrumented for timing diagnosis (boundary measurement)
import { Router, Request, Response, NextFunction } from "express";
import { getCacheStats } from "../src/lib/redisCache";
import { getUpstash } from "../src/lib/upstash";
import { nowISO } from "../helpers/time";

const router = Router();

// ─── Cache stats ────────────────────────────────────────────────────────
router.get("/cache/stats", (_req, res) => {
  res.json(getCacheStats());
});

// ─── Instrumented health endpoint ──────────────────────────────────────
router.get("/health", async (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers["x-request-id"] as string;
  const boundaries: Record<string, number> = {};
  const marks: Record<string, number> = {};
  
  const mark = (name: string) => {
    marks[name] = Date.now();
    if (Object.keys(marks).length > 1) {
      const keys = Object.keys(marks);
      boundaries[`${keys[keys.length-2]}→${name}`] = marks[name] - marks[keys[keys.length-2]];
    }
  };

  const logBoundary = (label: string, duration: number) => {
    console.log(`[HEALTH-${requestId}] ${label}: ${duration}ms`);
  };

  mark("handler-entry");

  // --- Cache check (synchronous) ---
  mark("cache-start");
  const redisStats = getCacheStats();
  mark("cache-end");

  // --- Database / store check (Upstash ping) ---
  mark("db-start");
  let dbStatus = "down";
  let dbError: string | null = null;
  try {
    mark("db-query-start");
    await getUpstash().ping();
    mark("db-query-end");
    dbStatus = "up";
  } catch (e) {
    mark("db-query-end");
    dbStatus = "down";
    dbError = (e as Error).message;
  }
  mark("db-end");

  // --- WAHA check ---
  mark("waha-start");
  let wahaStatus = "disabled";
  if (process.env.WAHA_BASE_URL) {
    try {
      mark("waha-fetch-start");
      const ping = await fetch(`${process.env.WAHA_BASE_URL}/api/sessions`, {
        signal: AbortSignal.timeout(3000),
      });
      mark("waha-fetch-end");
      wahaStatus = ping.ok ? "up" : "degraded";
    } catch (e) {
      mark("waha-fetch-end");
      wahaStatus = "down";
    }
  }
  mark("waha-end");

  mark("response-build-start");
  const overallHealthy = dbStatus === "up";
  mark("response-build-end");

  // Calculate boundaries from marks
  const m = marks;
  boundaries["total"] = m["response-build-end"] - m["handler-entry"];
  boundaries["cache"] = m["cache-end"] - m["cache-start"];
  boundaries["db-total"] = m["db-end"] - m["db-start"];
  boundaries["db-query"] = m["db-query-end"] - m["db-query-start"];
  boundaries["waha-total"] = m["waha-end"] - m["waha-start"];
  boundaries["waha-fetch"] = m["waha-fetch-end"] ? m["waha-fetch-end"] - m["waha-fetch-start"] : 0;
  boundaries["response-build"] = m["response-build-end"] - m["response-build-start"];

  // Log detailed timing
  console.log(`[HEALTH-${requestId}] BOUNDARIES:`, JSON.stringify(boundaries));
  console.log(`[HEALTH-${requestId}] RESULTS: db=${dbStatus} waha=${wahaStatus} cache=${redisStats.backend}`);
  if (dbError) console.log(`[HEALTH-${requestId}] DB ERROR:`, dbError);

  res.status(overallHealthy ? 200 : 503).json({
    status: overallHealthy ? "ok" : "degraded",
    timestamp: nowISO(),
    components: {
      database: dbStatus,
      store: dbStatus,
      whatsapp_waha: wahaStatus,
      cache: redisStats.backend,
    },
    _boundaries: boundaries, // temporary debug field
  });
});

export default router;
