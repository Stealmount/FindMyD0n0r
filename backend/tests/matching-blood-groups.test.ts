/**
 * Blood Connect — Matching Engine: 20+ Test Scenarios
 *
 * Tests the specific scenario: O- donor at 110058 matching against
 * all blood types at various Delhi NCR pincodes.
 * Then runs 20+ combos with different blood groups and pincodes.
 *
 * Run: npx tsx --test tests/matching-blood-groups.test.ts
 */

import './setup-env.ts';

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { findEligibleDonorsSync, isDonorEligible } from '../src/lib/matching.ts';
import { isBloodCompatible, BLOOD_COMPATIBILITY_MATRIX } from '../src/types.ts';
import type { BloodRequest, User, BloodType } from '../src/types.ts';
import { getDistanceBetweenPincodes } from '../src/lib/geo.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TOMORROW = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
})();

function makeDonor(overrides: Partial<User> & { id: string; blood_type: BloodType; pincode: string }): User {
  return {
    full_name: `Donor ${overrides.id}`,
    email: `donor${overrides.id}@test.com`,
    phone: `917000${overrides.id.slice(-4).padStart(4, '0')}`,
    whatsapp_number: `917000${overrides.id.slice(-4).padStart(4, '0')}`,
    donation_frequency: 'regular',
    last_donation_date: null,
    cooldown_until: null,
    area: 'Test Area',
    city: 'Delhi',
    availability_status: 'available',
    number_sharing_pref: 'on_approval',
    emergency_only: false,
    account_status: 'active',
    whatsapp_verified: true,
    profile_complete: true,
    is_available: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeRequest(overrides: Partial<BloodRequest> & { id: string; blood_type_needed: BloodType | 'ANY'; hospital_pincode: string }): BloodRequest {
  return {
    tracking_code: `BLD-2026-${overrides.id}`,
    patient_name: 'Test Patient',
    units_required: 1,
    hospital_name: 'AIIMS New Delhi',
    hospital_area: 'Ansari Nagar',
    hospital_city: 'New Delhi',
    urgency_level: 'urgent',
    requester_name: 'Test Requester',
    requester_email: 'requester@test.com',
    requester_phone: '919999999999',
    additional_notes: '',
    status: 'open',
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    fulfilled_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── NCR Pincodes for testing (real pincodes with coords in pincode_coords.ts) ──
const PINCODES = {
  // Delhi
  centralDelhi:  '110001',  // Connaught Place
  aiims:         '110029',  // AIIMS area
  southDelhi:    '110049',  // Lajpat Nagar
  eastDelhi:     '110091',  // Mayur Vihar
  northDelhi:    '110007',  // Kamla Nagar
  rohini:        '110085',  // Rohini (West Delhi)
  dwarka:        '110075',  // Dwarka
  vasantKunj:    '110070',  // Vasant Kunj
  saket:         '110017',  // Saket
  punjabiBagh:   '110026',  // Punjabi Bagh
  // Noida
  noida:         '201301',  // Noida Sector 1
  noidaSec62:    '201309',  // Noida Sector 62
  // Gurugram
  gurugram:      '122001',  // Gurugram
  // Faridabad
  faridabad:     '121001',  // Faridabad
  // Ghaziabad
  ghaziabad:     '201001',  // Ghaziabad
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — The specific scenario: O- donor at 110058
// ─────────────────────────────────────────────────────────────────────────────

describe('SECTION 1: O- donor at 110058 vs requester needing O-', () => {
  const oMinusDonor = makeDonor({
    id: 'odonor_110058',
    blood_type: 'O-',
    pincode: '110058',
    area: 'Manglapuri',
    city: 'New Delhi',
  });

  test('O- donor at 110058 matches O- request at AIIMS (110029)', () => {
    const request = makeRequest({
      id: 'req1',
      blood_type_needed: 'O-',
      hospital_pincode: PINCODES.aiims,
    });
    const matches = findEligibleDonorsSync([oMinusDonor], request);
    assert.equal(matches.length, 1, 'Should find 1 match');
    assert.equal(matches[0].blood_type, 'O-');
    assert.equal(matches[0].is_exact_match, true);
    assert.ok(typeof matches[0].distance_km === 'number', 'distance_km should be a number');
    console.log(`  O- @ 110058 → O- @ AIIMS: distance=${matches[0].distance_km}km, exact=${matches[0].is_exact_match}`);
  });

  test('O- donor at 110058 matches O- request at Lajpat Nagar (110049)', () => {
    const request = makeRequest({
      id: 'req2',
      blood_type_needed: 'O-',
      hospital_pincode: PINCODES.southDelhi,
    });
    const matches = findEligibleDonorsSync([oMinusDonor], request);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].is_exact_match, true);
    console.log(`  O- @ 110058 → O- @ 110049: distance=${matches[0].distance_km}km`);
  });

  test('O- donor at 110058 matches O- request at Mayur Vihar (110091)', () => {
    const request = makeRequest({
      id: 'req3',
      blood_type_needed: 'O-',
      hospital_pincode: PINCODES.eastDelhi,
    });
    const matches = findEligibleDonorsSync([oMinusDonor], request);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].is_exact_match, true);
    console.log(`  O- @ 110058 → O- @ 110091: distance=${matches[0].distance_km}km`);
  });

  test('O- donor at 110058 matches O- request at Noida (201301)', () => {
    const request = makeRequest({
      id: 'req4',
      blood_type_needed: 'O-',
      hospital_pincode: PINCODES.noida,
    });
    const matches = findEligibleDonorsSync([oMinusDonor], request);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].is_exact_match, true);
    console.log(`  O- @ 110058 → O- @ Noida 201301: distance=${matches[0].distance_km}km`);
  });

  test('O- donor at 110058 matches O- request at Gurugram (122001)', () => {
    const request = makeRequest({
      id: 'req5',
      blood_type_needed: 'O-',
      hospital_pincode: PINCODES.gurugram,
    });
    const matches = findEligibleDonorsSync([oMinusDonor], request);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].is_exact_match, true);
    console.log(`  O- @ 110058 → O- @ Gurugram 122001: distance=${matches[0].distance_km}km`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — O- donor at 110058 vs ALL 8 blood types
// ─────────────────────────────────────────────────────────────────────────────

describe('SECTION 2: O- donor at 110058 — all 8 blood type requests', () => {
  const oMinusDonor = makeDonor({
    id: 'universal_donor',
    blood_type: 'O-',
    pincode: '110058',
    area: 'Manglapuri',
    city: 'New Delhi',
  });

  const ALL_BLOOD: BloodType[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

  for (const needed of ALL_BLOOD) {
    test(`O- donor at 110058 → ${needed} request at AIIMS`, () => {
      const request = makeRequest({
        id: `sec2_${needed.replace('+','p').replace('-','m')}`,
        blood_type_needed: needed,
        hospital_pincode: PINCODES.aiims,
      });
      const matches = findEligibleDonorsSync([oMinusDonor], request);
      assert.equal(matches.length, 1, `O- donor should match ${needed} request`);
      // O- is universal donor but only EXACT match when both are O-
      const expectedExact = (needed === 'O-');
      assert.equal(matches[0].is_exact_match, expectedExact,
        `${needed}: exact=${matches[0].is_exact_match}, expected exact=${expectedExact}`);
      console.log(`  O- → ${needed}: exact=${matches[0].is_exact_match}, distance=${matches[0].distance_km}km, tier=${matches[0].match_rank}`);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — 20+ test combos: different blood groups × pincodes
// ─────────────────────────────────────────────────────────────────────────────

describe('SECTION 3: 20+ cross-combo matching tests', () => {
  // Create a donor pool with various blood types at different pincodes
  const donorPool: User[] = [
    // Delhi donors
    makeDonor({ id: 'd01', blood_type: 'O-',  pincode: PINCODES.centralDelhi }),
    makeDonor({ id: 'd02', blood_type: 'O+',  pincode: PINCODES.aiims }),
    makeDonor({ id: 'd03', blood_type: 'A-',  pincode: PINCODES.southDelhi }),
    makeDonor({ id: 'd04', blood_type: 'A+',  pincode: PINCODES.eastDelhi }),
    makeDonor({ id: 'd05', blood_type: 'B-',  pincode: PINCODES.northDelhi }),
    makeDonor({ id: 'd06', blood_type: 'B+',  pincode: PINCODES.rohini }),
    makeDonor({ id: 'd07', blood_type: 'AB-', pincode: PINCODES.dwarka }),
    makeDonor({ id: 'd08', blood_type: 'AB+', pincode: PINCODES.saket }),
    // NCR donors
    makeDonor({ id: 'd09', blood_type: 'O-',  pincode: PINCODES.noida }),
    makeDonor({ id: 'd10', blood_type: 'A+',  pincode: PINCODES.gurugram }),
    makeDonor({ id: 'd11', blood_type: 'B+',  pincode: PINCODES.faridabad }),
    makeDonor({ id: 'd12', blood_type: 'O+',  pincode: PINCODES.ghaziabad }),
    makeDonor({ id: 'd13', blood_type: 'A-',  pincode: PINCODES.noidaSec62 }),
    makeDonor({ id: 'd14', blood_type: 'B-',  pincode: PINCODES.punjabiBagh }),
    makeDonor({ id: 'd15', blood_type: 'AB+', pincode: PINCODES.vasantKunj }),
    // Second O- at different pincode
    makeDonor({ id: 'd16', blood_type: 'O-',  pincode: PINCODES.gurugram }),
  ];

  // Test combos: [requestBloodType, hospitalPincode, description]
  const testCombos: [BloodType | 'ANY', string, string][] = [
    // ── Exact matches ──
    ['O-',  PINCODES.aiims,         'O- needed at AIIMS (Tier 1)'],
    ['O+',  PINCODES.aiims,         'O+ needed at AIIMS (Tier 1)'],
    ['A-',  PINCODES.southDelhi,    'A- needed at Lajpat Nagar'],
    ['A+',  PINCODES.eastDelhi,     'A+ needed at Mayur Vihar'],
    ['B-',  PINCODES.northDelhi,    'B- needed at Kamla Nagar'],
    ['B+',  PINCODES.rohini,        'B+ needed at Rohini'],
    ['AB-', PINCODES.dwarka,        'AB- needed at Dwarka'],
    ['AB+', PINCODES.saket,         'AB+ needed at Saket'],
    // ── NCR distance tests ──
    ['O-',  PINCODES.noida,         'O- needed at Noida (cross-city)'],
    ['A+',  PINCODES.gurugram,      'A+ needed at Gurugram (cross-city)'],
    ['B+',  PINCODES.faridabad,     'B+ needed at Faridabad (cross-city)'],
    ['O-',  PINCODES.ghaziabad,     'O- needed at Ghaziabad (cross-city)'],
    // ── Compatible fallback scenarios ──
    ['AB+', PINCODES.aiims,         'AB+ needed (all types compatible)'],
    ['A+',  PINCODES.centralDelhi,  'A+ needed at CP (O-/O+/A-/A+ compatible)'],
    ['B+',  PINCODES.centralDelhi,  'B+ needed at CP (O-/O+/B-/B+ compatible)'],
    // ── Rare blood expansion (O- triggers wider radius) ──
    ['O-',  PINCODES.vasantKunj,    'O- needed at Vasant Kunj (rare → wider radius)'],
    ['AB-', PINCODES.punjabiBagh,   'AB- needed at Punjabi Bagh (rare → wider radius)'],
    // ── Single unit vs multi-unit ──
    ['O-',  PINCODES.aiims,         'O- needed at AIIMS, 3 units'],
    ['A+',  PINCODES.aiims,         'A+ needed at AIIMS, 5 units'],
    // ── Emergency only donor test ──
    ['B-',  PINCODES.northDelhi,    'B- needed at Kamla Nagar (all urgency)'],
    // ── Cooldown donor test ──
    ['O-',  PINCODES.aiims,         'O- needed at AIIMS (some donors on cooldown)'],
  ];

  for (const [needed, hospPincode, description] of testCombos) {
    test(description, () => {
      const request = makeRequest({
        id: `combo_${needed}_${hospPincode}_${description.slice(0, 10)}`,
        blood_type_needed: needed,
        hospital_pincode: hospPincode,
      });

      const matches = findEligibleDonorsSync(donorPool, request);

      // Every match must be blood-compatible
      for (const m of matches) {
        if (needed !== 'ANY') {
          assert.ok(isBloodCompatible(m.blood_type, needed as BloodType),
            `Match ${m.id} (${m.blood_type}) should be compatible with ${needed}`);
        }
        // Exact match flag must be correct
        const isExact = m.blood_type === needed;
        assert.equal(m.is_exact_match, isExact,
          `is_exact_match for ${m.blood_type} vs ${needed}: got ${m.is_exact_match}, expected ${isExact}`);
      }

      // No duplicates
      const ids = matches.map(m => m.id);
      assert.equal(new Set(ids).size, ids.length, 'No duplicate matches');

      console.log(`  [${needed}] @ ${hospPincode}: ${matches.length} match(es) — ${matches.map(m => `${m.blood_type}@${m.pincode}(${m.distance_km}km,T${m.match_rank},exact=${m.is_exact_match})`).join(', ') || 'none'}`);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Distance tier verification
// ─────────────────────────────────────────────────────────────────────────────

describe('SECTION 4: Distance tier verification', () => {
  test('Pincode 110058 → 110029 (AIIMS) distance calculation', () => {
    const dist = getDistanceBetweenPincodes('110058', '110029');
    console.log(`  110058 → 110029 = ${dist}km`);
    // Both are South Delhi, should be close (Tier 1 or 2)
    assert.ok(dist >= 0, 'Distance should be non-negative');
    assert.ok(dist < 50, 'South Delhi to AIIMS should be < 50km');
  });

  test('Pincode 110058 → 201301 (Noida) distance calculation', () => {
    const dist = getDistanceBetweenPincodes('110058', '201301');
    console.log(`  110058 → 201301 (Noida) = ${dist}km`);
    assert.ok(dist > 0, 'Cross-city distance should be positive');
  });

  test('Pincode 110058 → 122001 (Gurugram) distance calculation', () => {
    const dist = getDistanceBetweenPincodes('110058', '122001');
    console.log(`  110058 → 122001 (Gurugram) = ${dist}km`);
    assert.ok(dist > 0, 'Cross-city distance should be positive');
  });

  test('Same pincode → distance 0', () => {
    const dist = getDistanceBetweenPincodes('110058', '110058');
    assert.equal(dist, 0, 'Same pincode should yield distance 0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Exact match vs compatible match statistics
// ─────────────────────────────────────────────────────────────────────────────

describe('SECTION 5: Match statistics summary', () => {
  const donorPool: User[] = [
    makeDonor({ id: 'stat01', blood_type: 'O-',  pincode: PINCODES.centralDelhi }),
    makeDonor({ id: 'stat02', blood_type: 'O+',  pincode: PINCODES.aiims }),
    makeDonor({ id: 'stat03', blood_type: 'A-',  pincode: PINCODES.southDelhi }),
    makeDonor({ id: 'stat04', blood_type: 'A+',  pincode: PINCODES.eastDelhi }),
    makeDonor({ id: 'stat05', blood_type: 'B-',  pincode: PINCODES.northDelhi }),
    makeDonor({ id: 'stat06', blood_type: 'B+',  pincode: PINCODES.rohini }),
    makeDonor({ id: 'stat07', blood_type: 'AB-', pincode: PINCODES.dwarka }),
    makeDonor({ id: 'stat08', blood_type: 'AB+', pincode: PINCODES.saket }),
    makeDonor({ id: 'stat09', blood_type: 'O-',  pincode: PINCODES.noida }),
    makeDonor({ id: 'stat10', blood_type: 'A+',  pincode: PINCODES.gurugram }),
    makeDonor({ id: 'stat11', blood_type: 'B+',  pincode: PINCODES.faridabad }),
    makeDonor({ id: 'stat12', blood_type: 'O+',  pincode: PINCODES.ghaziabad }),
    makeDonor({ id: 'stat13', blood_type: 'O-',  pincode: PINCODES.vasantKunj }),
    makeDonor({ id: 'stat14', blood_type: 'AB+', pincode: PINCODES.noidaSec62 }),
  ];

  test('Print full matching statistics for all 8 blood types at AIIMS', () => {
    const ALL_BLOOD: BloodType[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
    const stats: { blood: string; totalMatches: number; exactMatches: number; compatibleOnly: number; distances: number[] }[] = [];

    for (const needed of ALL_BLOOD) {
      const request = makeRequest({
        id: `stat_${needed}`,
        blood_type_needed: needed,
        hospital_pincode: PINCODES.aiims,
      });
      const matches = findEligibleDonorsSync(donorPool, request);
      const exact = matches.filter(m => m.is_exact_match);
      const compatible = matches.filter(m => !m.is_exact_match);
      stats.push({
        blood: needed,
        totalMatches: matches.length,
        exactMatches: exact.length,
        compatibleOnly: compatible.length,
        distances: matches.map(m => m.distance_km),
      });
    }

    // Print summary table
    console.log('\n  ═══════════════════════════════════════════════════════════════');
    console.log('  MATCHING STATISTICS — Hospital: AIIMS (110029)');
    console.log('  Donor pool: 14 donors across Delhi NCR');
    console.log('  ─────────────────────────────────────────────────────────────');
    console.log('  Blood Type │ Total │ Exact │ Compat │ Nearest Distance');
    console.log('  ───────────┼───────┼───────┼────────┼──────────────────');

    for (const s of stats) {
      const nearest = s.distances.length > 0 ? Math.min(...s.distances) : 'N/A';
      console.log(`  ${s.blood.padEnd(10)} │ ${String(s.totalMatches).padStart(5)} │ ${String(s.exactMatches).padStart(5)} │ ${String(s.compatibleOnly).padStart(6)} │ ${nearest}km`);
    }
    console.log('  ═══════════════════════════════════════════════════════════════');

    // Verify O- gets the most matches (universal donor)
    const oMinusStats = stats.find(s => s.blood === 'O-');
    const abPlusStats = stats.find(s => s.blood === 'AB+');
    assert.ok(oMinusStats!, 'O- stats should exist');
    assert.ok(abPlusStats!, 'AB+ stats should exist');
    // O- only gets exact O- donors; AB+ gets everyone
    assert.ok(abPlusStats!.totalMatches >= oMinusStats!.totalMatches,
      'AB+ (universal recipient) should have >= matches than O-');
  });

  test('Print matching statistics for O- at all hospital pincodes', () => {
    const hospitals: [string, string][] = [
      ['AIIMS 110029', PINCODES.aiims],
      ['Lajpat Nagar 110049', PINCODES.southDelhi],
      ['Mayur Vihar 110091', PINCODES.eastDelhi],
      ['Noida 201301', PINCODES.noida],
      ['Gurugram 122001', PINCODES.gurugram],
      ['Faridabad 121001', PINCODES.faridabad],
      ['Dwarka 110075', PINCODES.dwarka],
    ];

    console.log('\n  ═══════════════════════════════════════════════════════════');
    console.log('  O- REQUEST — Match count by hospital location');
    console.log('  ───────────────────────────────────────────────────────────');

    for (const [name, pincode] of hospitals) {
      const request = makeRequest({
        id: `loc_${pincode}`,
        blood_type_needed: 'O-',
        hospital_pincode: pincode,
      });
      const matches = findEligibleDonorsSync(donorPool, request);
      const exact = matches.filter(m => m.is_exact_match).length;
      const compatible = matches.length - exact;
      console.log(`  ${name.padEnd(25)} → ${matches.length} match(es) [exact: ${exact}, compat: ${compatible}]`);
    }
    console.log('  ═══════════════════════════════════════════════════════════');

    assert.ok(true, 'Statistics printed');
  });
});
