import 'dotenv/config';
import './setup-env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { saveDoc as dbSaveDoc, deleteDoc as dbDeleteDoc, getDoc as dbGetDoc, getCollection as dbGetCollection, isFirebaseConfigured } from '../src/lib/serverDb';
import { getUpstash, k } from '../src/lib/upstash';
import { approveMatchById } from '../routes/matching';
import { nowISO } from '../helpers/time';

// Real concurrency verification of the atomic capacity claim (Lua script in
// backend/helpers/capacityClaim.ts). These tests run ONLY against the real
// Upstash store — the JavaSscript fallback path is deliberately not exercised
// here. We assert the ACTUAL approved-match count in the store (never the
// Math.min()-capped counter) plus unique unit slots.

function testRequest(unitsRequired: number, tag: string) {
  const id = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    tracking_code: `BLD-${tag.toUpperCase()}-${nowISO().slice(0, 10)}`,
    patient_name: 'Race Patient',
    blood_type_needed: 'O+',
    units_required: unitsRequired,
    hospital_name: 'Race Hospital',
    hospital_pincode: '110001',
    hospital_area: 'Delhi',
    hospital_city: 'New Delhi',
    urgency_level: 'urgent',
    requester_name: 'Race Requester',
    requester_phone: '',
    requester_email: '',
    additional_notes: '',
    status: unitsRequired > 0 ? 'partially_matched' : 'open',
    units_confirmed: 0,
    expires_at: nowISO(),
    fulfilled_at: null,
    created_at: nowISO(),
    updated_at: nowISO(),
  };
}

async function seedUser(id: string) {
  await dbSaveDoc('users', id, {
    id,
    phone: `91999${String(Math.abs(id.split('-').reduce((a, c) => a + c.length, 0)) % 100000000).padStart(8, '0')}`,
    full_name: `Donor ${id}`,
    blood_type: 'O+',
    pincode: '110001',
    availability_status: 'available',
    account_status: 'active',
    created_at: nowISO(),
    updated_at: nowISO(),
  } as unknown as Record<string, unknown>);
}

async function seedMatch(id: string, requestId: string, donorId: string, response: 'approved' | 'pending', slot?: number) {
  await dbSaveDoc('matches', id, {
    id,
    request_id: requestId,
    donor_id: donorId,
    donor_response: response,
    donor_response_at: response === 'approved' ? nowISO() : null,
    contact_shared_at: response === 'approved' ? nowISO() : null,
    unit_slot: slot ?? null,
    notification_channel: 'whatsapp',
    created_at: nowISO(),
  } as unknown as Record<string, unknown>);
}

async function cleanup(ids: { requestId?: string; matchIds: string[]; donorIds: string[] }) {
  for (const id of ids.matchIds) await dbDeleteDoc('matches', id).catch(() => {});
  for (const id of ids.donorIds) await dbDeleteDoc('users', id).catch(() => {});
  if (ids.requestId) {
    await dbDeleteDoc('blood_requests', ids.requestId).catch(() => {});
    await getUpstash().del(k(`capslot:${ids.requestId}`)).catch(() => {});
  }
}

test('final-slot race: 2 concurrent approvals for the last of 5 units — exactly one wins slot 5', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured — race test requires the real Upstash store');

  const req = testRequest(5, 'race5');
  req.units_confirmed = 4;
  await dbSaveDoc('blood_requests', req.id, req as unknown as Record<string, unknown>);

  const matchIds: string[] = [];
  const donorIds: string[] = [];
  const p1 = `race5-p1-${randomUUID().slice(0, 8)}`;
  const p2 = `race5-p2-${randomUUID().slice(0, 8)}`;

  try {
    for (let i = 1; i <= 4; i++) {
      const donor = `race5-d${i}-${randomUUID().slice(0, 8)}`;
      donorIds.push(donor);
      await seedUser(donor);
      const m = `race5-a${i}-${randomUUID().slice(0, 8)}`;
      matchIds.push(m);
      await seedMatch(m, req.id, donor, 'approved', i);
    }
    for (const p of [p1, p2]) {
      const donor = `race5-dp-${randomUUID().slice(0, 8)}`;
      donorIds.push(donor);
      await seedUser(donor);
      matchIds.push(p);
      await seedMatch(p, req.id, donor, 'pending');
    }

    const results = await Promise.all([approveMatchById(p1), approveMatchById(p2)]);

    const winners = results.filter((r) => r.ok);
    const losers = results.filter((r) => !r.ok);
    assert.equal(winners.length, 1, 'exactly one concurrent approval must win the final slot');
    assert.equal(losers.length, 1, 'exactly one concurrent approval must lose');
    assert.equal(losers[0].status, 409, 'losing approval must be a conflict (409)');

    const all = await dbGetCollection<{ id: string; request_id: string; donor_response: string; unit_slot?: number | null; contact_shared_at?: string | null }>('matches');
    const reqMatches = all.filter((m) => m.request_id === req.id);
    const approved = reqMatches.filter((m) => m.donor_response === 'approved');
    const slots = approved.map((m) => m.unit_slot);

    // ACTUAL store count — not the Math.min()-capped lifecycle counter.
    assert.equal(approved.length, 5, 'total approved contributions must be exactly units_required');
    assert.deepEqual([...slots].sort((a, b) => (a ?? 0) - (b ?? 0)), [1, 2, 3, 4, 5], 'slots 1..5 claimed exactly once');
    assert.equal(new Set(slots).size, 5, 'no duplicate unit slot may exist');
    for (const m of approved) assert.ok(m.unit_slot != null, 'every approved match must hold a unit slot');

    const claimWinner = reqMatches.find((m) => m.id === p1 || m.id === p2) as { id: string; donor_response: string; unit_slot?: number | null; contact_shared_at?: string | null };
    const loser = [p1, p2].find((id) => id !== claimWinner.id);
    const loserMatch = reqMatches.find((m) => m.id === loser) as { donor_response: string; unit_slot?: number | null; contact_shared_at?: string | null };
    assert.equal(claimWinner.donor_response, 'approved', 'winner must be approved');
    assert.equal(claimWinner.unit_slot, 5, 'winner must claim the final free slot');
    assert.equal(loserMatch.donor_response, 'pending', 'loser must stay pending (never approved)');
    assert.ok(!loserMatch.contact_shared_at, 'loser must receive no success-only contact sharing');
    assert.ok(loserMatch.unit_slot == null, 'loser must not occupy a unit slot');

    const request = await dbGetDoc<{ units_confirmed?: number; status?: string; fulfilled_at?: string | null }>('blood_requests', req.id);
    assert.equal(request?.units_confirmed, 5, 'units_confirmed must be exactly 5');
    assert.equal(request?.status, 'fulfilled');
    assert.ok(request?.fulfilled_at, 'fulfilled_at must be stamped');

    // Idempotent duplicate handling: re-approving the winning match is refused.
    const dup = await approveMatchById(claimWinner.id);
    assert.ok(!dup.ok, 'duplicate approval of an already-approved match must fail');
    assert.equal(dup.status, 409);
    const afterDup = await dbGetCollection<{ request_id: string; donor_response: string }>('matches');
    assert.equal(afterDup.filter((m) => m.request_id === req.id && m.donor_response === 'approved').length, 5, 'duplicate re-approval must not change the store count');
  } finally {
    await cleanup({ requestId: req.id, matchIds, donorIds });
  }
});

test('multi-approval race: 6 donors race for 5 remaining units — exactly 5 win with unique slots', async (t) => {
  if (!isFirebaseConfigured()) return t.skip('Store not configured — race test requires the real Upstash store');

  const req = testRequest(5, 'race6');
  req.units_confirmed = 0;
  req.status = 'matching';
  await dbSaveDoc('blood_requests', req.id, req as unknown as Record<string, unknown>);

  const matchIds: string[] = [];
  const donorIds: string[] = [];
  const pendings: string[] = [];

  try {
    for (let i = 1; i <= 6; i++) {
      const donor = `race6-d${i}-${randomUUID().slice(0, 8)}`;
      donorIds.push(donor);
      await seedUser(donor);
      const m = `race6-p${i}-${randomUUID().slice(0, 8)}`;
      matchIds.push(m);
      pendings.push(m);
      await seedMatch(m, req.id, donor, 'pending');
    }

    const results = await Promise.all(pendings.map((id) => approveMatchById(id)));

    const winners = results.filter((r) => r.ok);
    const losers = results.filter((r) => !r.ok);
    assert.equal(winners.length, 5, 'exactly units_required approvals may succeed');
    assert.equal(losers.length, 1);
    assert.equal(losers[0].status, 409, 'the over-capacity approval must be a conflict');

    const all = await dbGetCollection<{ id: string; request_id: string; donor_response: string; unit_slot?: number | null; contact_shared_at?: string | null }>('matches');
    const reqMatches = all.filter((m) => m.request_id === req.id);
    const approved = reqMatches.filter((m) => m.donor_response === 'approved');
    const slots = approved.map((m) => m.unit_slot);

    assert.equal(approved.length, 5, 'successful approved contributions must never exceed units_required');
    assert.deepEqual([...slots].sort((a, b) => (a ?? 0) - (b ?? 0)), [1, 2, 3, 4, 5], 'all successful approvals must hold unique slots 1..5');
    assert.equal(new Set(slots).size, 5, 'no duplicate slot may exist');

    const stillPending = reqMatches.find((m) => m.donor_response === 'pending');
    assert.ok(stillPending, 'exactly one match must remain pending');
    assert.ok(!stillPending.contact_shared_at, 'the losing donor must not get success-only side effects');
    assert.ok(stillPending.unit_slot == null);

    const request = await dbGetDoc<{ units_confirmed?: number; status?: string }>('blood_requests', req.id);
    assert.equal(request?.units_confirmed, 5);
    assert.equal(request?.status, 'fulfilled');
  } finally {
    await cleanup({ requestId: req.id, matchIds, donorIds });
  }
});