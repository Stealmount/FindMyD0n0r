/**
 * Document store API on Upstash Redis — THE migration target for Phase 3.
 *
 * Doc shape parity with db.ts/serverDb.ts:
 *   - documents are JSON strings at key `<prefix><table>:<id>`
 *   - readers return { id, ...data }
 *
 * Index maintenance happens inside saveDoc/deleteDoc/addDoc via ONE pipeline
 * per write (single HTTP round-trip; note: Upstash pipelines are NOT
 * transactions — other clients may interleave).
 *
 * Errors are NEVER swallowed here — that stays in the serverDb wrapper layer.
 */

import { randomUUID } from "node:crypto";
import { getUpstash, k, type Redis } from "./upstash";

export class StoreNotFoundError extends Error {
  constructor(table: string, id: string) {
    super(`Document not found: ${table}/${id}`);
    this.name = "StoreNotFoundError";
  }
}

type DocData = Record<string, unknown>;

type IndexConfig =
  | { kind: "email_to_uid" }
  | { kind: "donor_profile_sets" }
  | { kind: "requester_set_and_recent_zset" }
  | { kind: "recipient_set" }
  | { kind: "msgq_zset" };

const TABLE_INDEXES: Record<string, IndexConfig> = {
  profiles: { kind: "email_to_uid" },
  donor_profiles: { kind: "donor_profile_sets" },
  blood_requests: { kind: "requester_set_and_recent_zset" },
  notifications: { kind: "recipient_set" },
  message_queue: { kind: "msgq_zset" },
};

const IDX_SET_SUFFIX = "idx";

function docKey(table: string, id: string): string {
  return k(`${table}:${id}`);
}
function idxSet(table: string): string {
  return k(`${IDX_SET_SUFFIX}:${table}`);
}

function emailField(email: unknown): string | null {
  const s = String(email ?? "").toLowerCase().trim();
  return s ? s : null;
}

/** Flat donor_profiles fields first; nested view as fallback. */
function donorPincode(doc: DocData): string | null {
  const v = doc.pincode ?? (doc.donor_profile as DocData | undefined)?.pincode;
  const s = String(v ?? "").trim();
  return s ? s : null;
}
function donorBloodGroup(doc: DocData): string | null {
  const v = doc.blood_group ?? (doc.donor_profile as DocData | undefined)?.blood_group;
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function tsScore(...candidates: unknown[]): number {
  for (const c of candidates) {
    if (c === null || c === undefined || c === "") continue;
    const n = Date.parse(String(c));
    if (!Number.isNaN(n)) return n;
  }
  return Date.now();
}

function applyIndexWrites(
  p: ReturnType<Redis["pipeline"]>,
  table: string,
  id: string,
  oldDoc: DocData | null,
  newDoc: DocData | null
): void {
  const cfg = TABLE_INDEXES[table];
  if (!cfg) return;

  switch (cfg.kind) {
    case "email_to_uid": {
      const hKey = k("h:email_to_uid");
      const oldF = oldDoc ? emailField(oldDoc.email) : null;
      const newF = newDoc ? emailField(newDoc.email) : null;
      if (oldF && oldF !== newF) p.hdel(hKey, oldF);
      if (newF) p.hset(hKey, { [newF]: id });
      break;
    }
    case "donor_profile_sets": {
      const oldPin = oldDoc ? donorPincode(oldDoc) : null;
      const newPin = newDoc ? donorPincode(newDoc) : null;
      if (oldPin && oldPin !== newPin) p.srem(k(`s:dprof:pin:${oldPin}`), id);
      if (newPin) p.sadd(k(`s:dprof:pin:${newPin}`), id);
      const oldBg = oldDoc ? donorBloodGroup(oldDoc) : null;
      const newBg = newDoc ? donorBloodGroup(newDoc) : null;
      if (oldBg && oldBg !== newBg) p.srem(k(`s:dprof:bg:${oldBg}`), id);
      if (newBg) p.sadd(k(`s:dprof:bg:${newBg}`), id);
      break;
    }
    case "requester_set_and_recent_zset": {
      const oldReq = oldDoc?.requester_id != null ? String(oldDoc.requester_id) : null;
      const newReq = newDoc?.requester_id != null ? String(newDoc.requester_id) : null;
      if (oldReq && oldReq !== newReq) p.srem(k(`s:req:requester:${oldReq}`), id);
      if (newReq) p.sadd(k(`s:req:requester:${newReq}`), id);
      if (newDoc) {
        p.zadd(k("z:req:recent"), {
          score: tsScore(newDoc.created_at),
          member: id,
        });
      } else {
        p.zrem(k("z:req:recent"), id);
      }
      break;
    }
    case "recipient_set": {
      const oldR = oldDoc?.recipient_id != null ? String(oldDoc.recipient_id) : null;
      const newR = newDoc?.recipient_id != null ? String(newDoc.recipient_id) : null;
      if (oldR && oldR !== newR) p.srem(k(`s:notif:recipient:${oldR}`), id);
      if (newR) p.sadd(k(`s:notif:recipient:${newR}`), id);
      break;
    }
    case "msgq_zset": {
      // Only queued (deliverable) rows belong in the schedule zset. A claim
      // (queued → processing) removes the member via zrem in messaging.ts and
      // the saveDoc here must NOT re-add it — the zset doubles as the
      // claim-ownership ledger (stale reclaim works via ZADD NX). Processing
      // rows are left untouched so a successful reclaim's NX marker persists;
      // terminal rows (sent/failed/suppressed) are removed here and by
      // messaging.ts's explicit zrems.
      if (newDoc && newDoc.status === "queued") {
        // next_attempt_at is future-proofing; real rows carry scheduled_send_time/created_at.
        p.zadd(k("z:msgq"), {
          score: tsScore(newDoc.next_attempt_at, newDoc.scheduled_send_time, newDoc.created_at),
          member: id,
        });
      } else if (!newDoc || newDoc.status !== "processing") {
        p.zrem(k("z:msgq"), id);
      }
      break;
    }
  }
}

async function readRaw(table: string, id: string): Promise<unknown> {
  // NOTE: @upstash/redis auto-parses JSON responses, so this may be an object
  // or the raw string depending on payload shape.
  return await getUpstash().get(docKey(table, id));
}

function parseDoc<T>(raw: unknown): T | null {
  try {
    let v: unknown = raw;
    if (typeof v === "string") v = JSON.parse(v);
    if (v && typeof v === "object") return v as T;
    return null;
  } catch {
    return null;
  }
}

export async function getDoc<T>(table: string, id: string): Promise<T | null> {
  const raw = await readRaw(table, id);
  if (!raw) return null;
  const data = parseDoc<DocData>(raw);
  if (!data) return null;
  return { id, ...data } as T;
}

async function mgetChunked(keys: string[]): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let i = 0; i < keys.length; i += 100) {
    out.push(...((await getUpstash().mget(...keys.slice(i, i + 100))) as unknown[]));
  }
  return out;
}

function hydrate<T>(id: string, raw: unknown): T | null {
  if (raw == null) return null;
  const data = parseDoc<DocData>(raw);
  if (!data) return null;
  return { id, ...data } as T;
}

export async function getAll<T>(table: string): Promise<T[]> {
  const ids = (await getUpstash().smembers(idxSet(table))) as string[];
  if (ids.length === 0) return [];
  const raws = await mgetChunked(ids.map((id) => docKey(table, id)));
  const docs: T[] = [];
  for (let i = 0; i < ids.length; i++) {
    const doc = hydrate<T>(ids[i], raws[i]);
    if (doc !== null) docs.push(doc); // skip stale index entries / unparseable payloads
  }
  return docs;
}

export async function mgetDocs<T>(table: string, ids: string[]): Promise<(T | null)[]> {
  if (ids.length === 0) return [];
  const raws = await mgetChunked(ids.map((id) => docKey(table, id)));
  return raws.map((raw, i) => hydrate<T>(ids[i], raw));
}

export async function getByIndex<T>(
  table: string,
  indexKey: string,
  values: string[]
): Promise<T[]> {
  if (values.length === 0) return [];
  const keys = values.map((v) => k(`${indexKey}${v}`)) as [string, ...string[]];
  const ids = (await getUpstash().sunion(...keys)) as string[];
  if (ids.length === 0) return [];
  const raws = await mgetChunked(ids.map((id) => docKey(table, id)));
  const docs: T[] = [];
  for (let i = 0; i < ids.length; i++) {
    const doc = hydrate<T>(ids[i], raws[i]);
    if (doc !== null) docs.push(doc);
  }
  return docs;
}

export async function saveDoc(
  table: string,
  id: string,
  data: DocData,
  opts?: { merge?: boolean }
): Promise<void> {
  const redis = getUpstash();
  const merge = opts?.merge !== false; // default merge=true (upsert semantics)
  let stored: DocData;
  let oldDoc: DocData | null = null;
  if (merge) {
    // NOTE: read-modify-write — not atomic; concurrent writers can lose updates.
    const oldRaw = await readRaw(table, id);
    oldDoc = oldRaw ? parseDoc<DocData>(oldRaw) : null;
    stored = { ...(oldDoc ?? {}), ...data };
  } else {
    stored = { ...data };
  }

  const p = redis.pipeline();
  p.set(docKey(table, id), JSON.stringify(stored));
  p.sadd(idxSet(table), id);
  applyIndexWrites(p, table, id, oldDoc, stored);
  await p.exec();
}

export async function updateDoc(table: string, id: string, patch: DocData): Promise<void> {
  const redis = getUpstash();
  const oldRaw = await readRaw(table, id);
  if (!oldRaw) throw new StoreNotFoundError(table, id);
  const oldDoc = parseDoc<DocData>(oldRaw) ?? {};
  const stored = { ...oldDoc, ...patch };

  const p = redis.pipeline();
  p.set(docKey(table, id), JSON.stringify(stored));
  p.sadd(idxSet(table), id);
  applyIndexWrites(p, table, id, oldDoc, stored);
  await p.exec();
}

export async function deleteDoc(table: string, id: string): Promise<void> {
  const redis = getUpstash();
  const oldRaw = await readRaw(table, id);
  const oldDoc = oldRaw ? parseDoc<DocData>(oldRaw) : null;

  const p = redis.pipeline();
  p.del(docKey(table, id));
  p.srem(idxSet(table), id);
  applyIndexWrites(p, table, id, oldDoc, null);
  await p.exec();
}

export async function addDoc(table: string, data: DocData): Promise<{ id: string }> {
  const id = randomUUID();
  await saveDoc(table, id, data);
  return { id };
}

// ─── Low-level ZSET passthroughs (keys are logical names; prefixed via k()) ──

export async function zadd(key: string, score: number, member: string): Promise<void> {
  await getUpstash().zadd(k(key), { score, member });
}

export async function zrangeByScore(
  key: string,
  min: number,
  max: number,
  opts?: { offset?: number; count?: number; rev?: boolean }
): Promise<string[]> {
  const zOpts: Record<string, unknown> = { byScore: true };
  if (opts?.rev) zOpts.rev = true;
  if (opts?.offset !== undefined && opts?.count !== undefined) {
    zOpts.offset = opts.offset;
    zOpts.count = opts.count;
  }
  return getUpstash().zrange(k(key), min, max, zOpts as Parameters<Redis["zrange"]>[3]) as Promise<string[]>;
}

export async function zrem(key: string, member: string): Promise<void> {
  await getUpstash().zrem(k(key), member);
}
