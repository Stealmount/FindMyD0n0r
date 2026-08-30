/**
 * Store smoke test — Phase 2 (upstash-migration).
 * Run: npx tsx backend/scripts/store-smoke.ts
 *
 * Forces UPSTASH_KEY_PREFIX="fmdt:" BEFORE importing store (dynamic import —
 * static imports would hoist), loads .env the same way backend/server.ts does
 * ("dotenv/config"), exercises every store API against the real Upstash
 * instance, then SCAN-deletes all fmdt:* keys. Exit 1 on any failure.
 */

import "dotenv/config";

process.env.UPSTASH_KEY_PREFIX = "fmdt:";

type Step = { name: string; run: () => Promise<string> };

async function main() {
  const { getUpstash, k } = await import("../src/lib/upstash");
  const store = await import("../src/lib/store");

  const redis = getUpstash();
  const failures: string[] = [];
  const steps: Step[] = [];

  const step = (name: string, run: () => Promise<string>): Step => ({ name, run });

  // ─── 1. saveDoc merge & replace ───
  steps.push(
    step("saveDoc merge=true shallow-merges", async () => {
      await store.saveDoc("profiles", "smoke1", { full_name: "A", email: "a@x.com" });
      await store.saveDoc("profiles", "smoke1", { phone: "123" });
      const doc = await store.getDoc<{ full_name: string; email: string; phone: string }>("profiles", "smoke1");
      if (!doc || doc.full_name !== "A" || doc.email !== "a@x.com" || doc.phone !== "123")
        throw new Error(`merge lost fields: ${JSON.stringify(doc)}`);
      return "merged fields intact";
    })
  );

  steps.push(
    step("saveDoc merge=false replaces whole doc", async () => {
      await store.saveDoc("profiles", "smoke2replace", { full_name: "B", extra: "gone" }, { merge: false });
      await store.saveDoc("profiles", "smoke2replace", { full_name: "B2" }, { merge: false });
      const doc = await store.getDoc<Record<string, unknown>>("profiles", "smoke2replace");
      if (!doc || doc.extra !== undefined || doc.full_name !== "B2" || Object.keys(doc).length !== 2)
        throw new Error(`replace left residue: ${JSON.stringify(doc)}`);
      return "old fields gone, only new payload + id";
    })
  );

  // ─── 2. getDoc roundtrip: nested objects + arrays survive JSON ───
  steps.push(
    step("getDoc roundtrip nested objects + arrays", async () => {
      const src = {
        donor_profile: { pincode: "110001", tags: ["a", "b"], nested: { deep: [1, 2, { x: true }] } },
        units: [3, 1, 4],
      };
      await store.saveDoc("donor_profiles", "smoke3", src);
      const doc = await store.getDoc<typeof src>("donor_profiles", "smoke3");
      if (JSON.stringify(doc?.donor_profile) !== JSON.stringify(src.donor_profile) ||
          JSON.stringify(doc?.units) !== JSON.stringify(src.units))
        throw new Error(`JSON roundtrip mismatch: ${JSON.stringify(doc)}`);
      return "deep structures identical";
    })
  );

  // ─── 3. getAll ───
  steps.push(
    step("getAll returns docs with ids", async () => {
      await store.saveDoc("notifications", "smoken1", { recipient_id: "u_smoke" });
      await store.saveDoc("notifications", "smoken2", { recipient_id: "u_smoke" });
      const all = await store.getAll<{ id: string; recipient_id: string }>("notifications");
      const mine = all.filter((d) => d.id === "smoken1" || d.id === "smoken2");
      if (mine.length !== 2 || !mine.every((d) => d.recipient_id === "u_smoke"))
        throw new Error(`getAll missing docs: ${JSON.stringify(all.map((d) => d.id))}`);
      return `found both seeded docs (${all.length} total in table)`;
    })
  );

  // ─── 4. getByIndex (donor_profiles SETs) ───
  steps.push(
    step("getByIndex union of per-value SETs", async () => {
      await store.saveDoc("donor_profiles", "smoked1", { pincode: "999901", blood_group: "AB-" }, { merge: false });
      await store.saveDoc("donor_profiles", "smoked2", { pincode: "999902", blood_group: "AB-" }, { merge: false });
      await store.saveDoc("donor_profiles", "smoked3", { pincode: "999903", blood_group: "O+" }, { merge: false });
      const byPin = await store.getByIndex<{ id: string }>("donor_profiles", "s:dprof:pin:", ["999901", "999902"]);
      const byBg = await store.getByIndex<{ id: string }>("donor_profiles", "s:dprof:bg:", ["AB-"]);
      const pins = byPin.map((d) => d.id).sort();
      const bgs = byBg.map((d) => d.id).sort();
      if (JSON.stringify(pins) !== JSON.stringify(["smoked1", "smoked2"]))
        throw new Error(`pin index wrong: ${pins}`);
      if (JSON.stringify(bgs) !== JSON.stringify(["smoked1", "smoked2"]))
        throw new Error(`bg index wrong: ${bgs}`);
      return "pin + blood_group SET indexes resolve correctly";
    })
  );

  // ─── 5. mgetDocs preserves order and nulls ───
  steps.push(
    step("mgetDocs order + nulls preserved", async () => {
      const res = await store.mgetDocs<{ id: string } | null>("donor_profiles", ["smoked1", "does-not-exist", "smoked2"]);
      if (res.length !== 3 || res[0]?.id !== "smoked1" || res[1] !== null || res[2]?.id !== "smoked2")
        throw new Error(`mgetDocs wrong: ${JSON.stringify(res)}`);
      return "[doc, null, doc] as requested";
    })
  );

  // ─── 6. updateDoc on missing doc throws StoreNotFoundError ───
  steps.push(
    step("updateDoc missing throws StoreNotFoundError", async () => {
      try {
        await store.updateDoc("profiles", "ghost-id", { x: 1 });
      } catch (e: any) {
        if (e instanceof store.StoreNotFoundError && e.name === "StoreNotFoundError") {
          return `threw: ${e.message}`;
        }
        throw new Error(`wrong error type: ${e?.constructor?.name}: ${e?.message}`);
      }
      throw new Error("updateDoc on missing doc did NOT throw");
    })
  );

  // ─── 7. deleteDoc cleans primary + secondary indexes ───
  steps.push(
    step("deleteDoc removes doc from idx + secondary sets", async () => {
      await store.deleteDoc("donor_profiles", "smoked1");
      const gone = await store.getDoc("donor_profiles", "smoked1");
      if (gone !== null) throw new Error("doc still readable after delete");
      const idxMembers = await redis.smembers<string[]>(k("idx:donor_profiles"));
      if (idxMembers.includes("smoked1")) throw new Error(`idx still has smoked1: ${idxMembers}`);
      const pinSet = await redis.smembers<string[]>(k("s:dprof:pin:999901"));
      if (pinSet.includes("smoked1")) throw new Error(`pin set still has smoked1`);
      const bgSet = await redis.smembers<string[]>(k("s:dprof:bg:AB-"));
      if (bgSet.includes("smoked1")) throw new Error(`bg set still has smoked1`);
      await store.deleteDoc("profiles", "smoke1");
      const reqIdx = await redis.smembers<string[]>(k("idx:profiles"));
      if (reqIdx.includes("smoke1")) throw new Error(`profiles idx still has smoke1`);
      await store.deleteDoc("profiles", "smoke2replace");
      await store.deleteDoc("notifications", "smoken1");
      await store.deleteDoc("notifications", "smoken2");
      const notifIdx = await redis.smembers<string[]>(k("idx:notifications"));
      if (notifIdx.includes("smoken1") || notifIdx.includes("smoken2"))
        throw new Error(`notif idx dirty: ${notifIdx}`);
      return "SMEMBERS clean for all touched index sets";
    })
  );

  // ─── 8. addDoc id format ───
  steps.push(
    step("addDoc generates UUIDv4-format id", async () => {
      const { id } = await store.addDoc("blood_requests", {
        requester_id: "req_smoke",
        created_at: "2026-08-23T10:00:00.000Z",
      });
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRe.test(id)) throw new Error(`bad id: ${id}`);
      const doc = await store.getDoc<{ requester_id: string }>("blood_requests", id);
      if (!doc || doc.requester_id !== "req_smoke") throw new Error("addDoc roundtrip failed");
      const set = await redis.smembers<string[]>(k("s:req:requester:req_smoke"));
      if (!set.includes(id)) throw new Error("requester SET index missing addDoc id");
      await store.deleteDoc("blood_requests", id);
      return `id=${id}`;
    })
  );

  // ─── 9. zadd / zrangeByScore / zrem passthroughs ───
  steps.push(
    step("zadd → zrangeByScore → zrem sequence", async () => {
      await store.zadd("z:smoke", 100, "m1");
      await store.zadd("z:smoke", 200, "m2");
      await store.zadd("z:smoke", 300, "m3");
      const mid = await store.zrangeByScore("z:smoke", 150, 250);
      if (JSON.stringify(mid) !== JSON.stringify(["m2"])) throw new Error(`range wrong: ${mid}`);
      const all = await store.zrangeByScore("z:smoke", 0, 100000);
      if (all.length !== 3) throw new Error(`expected 3 members, got ${all.length}`);
      await store.zrem("z:smoke", "m2");
      const after = await store.zrangeByScore("z:smoke", 150, 250);
      if (after.length !== 0) throw new Error(`zrem failed: ${after}`);
      return "scores ordered, range filtered, member removed";
    })
  );

  console.log("store-smoke — against real Upstash\n");
  for (const s of steps) {
    try {
      const detail = await s.run();
      console.log(`PASS  ${s.name}${detail ? ` — ${detail}` : ""}`);
    } catch (e: any) {
      failures.push(s.name);
      console.log(`FAIL  ${s.name} — ${e?.message || e}`);
    }
  }

  // ─── Cleanup: SCAN-delete ALL fmdt:* keys ───
  let deleted = 0;
  let cursor: string | number = "0";
  do {
    const [next, keys] = await redis.scan(cursor, { match: "fmdt:*", count: 200 });
    cursor = next;
    if (keys.length > 0) {
      await redis.del(...keys);
      deleted += keys.length;
    }
  } while (String(cursor) !== "0");

  console.log(`\nCleanup: SCAN-deleted ${deleted} fmdt:* key(s)`);
  if (failures.length > 0) {
    console.log(`SUMMARY: ${steps.length - failures.length}/${steps.length} PASS — FAILURES: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log(`SUMMARY: ${steps.length}/${steps.length} PASS`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
