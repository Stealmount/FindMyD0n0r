import { BloodRequest, User, Match, isBloodCompatible, BLOOD_COMPATIBILITY_MATRIX, BloodType } from '../types';
import { getDistanceBetweenPincodes } from './geo';

/**
 * Pure (no I/O) eligibility check for a single donor against a request.
 * Used directly by the test suite to run matching logic over synthetic donor pools.
 */
export function isDonorEligible(donor: User, request: BloodRequest, todayStr: string): boolean {
  if (donor.account_status !== 'active') return false;
  if (!donor.whatsapp_verified) return false;
  if (donor.profile_complete === false) return false;
  if (donor.is_available === false) return false;
  if (donor.availability_status === 'unavailable') return false;
  if (donor.cooldown_until && donor.cooldown_until >= todayStr) return false;
  if (request.blood_type_needed !== 'ANY') {
    const donorType = (donor.blood_type || '').toUpperCase().trim() as BloodType;
    if (!isBloodCompatible(donorType, request.blood_type_needed as BloodType)) return false;
  }
  // Emergency-only restriction removed: all requests (planned, urgent, critical) match available donors
  // if (donor.emergency_only && request.urgency_level !== 'critical') return false;
  if (donor.phone === request.requester_phone) return false;
  if ((donor.email || '').toLowerCase().trim() === (request.requester_email || '').toLowerCase().trim()) return false;
  return true;
}

/**
 * Pure (no I/O) function: filters and ranks a supplied donor pool against a request.
 * Returns donors tagged with distance_km, match_rank, and is_exact_match.
 * Used by the test suite to drive the engine with synthetic data.
 */
export function findEligibleDonorsSync(
  allDonors: User[],
  request: BloodRequest,
  existingMatchedIds: Set<string> = new Set()
): (User & { distance_km: number; match_rank: number; is_exact_match: boolean })[] {
  const todayStr = new Date().toISOString().split('T')[0];
  const neededBlood = (request.blood_type_needed || '').toUpperCase().trim();
  const reqHospPin  = (request.hospital_pincode || '').replace(/\s+/g, '');
  const reqHospCity = (request.hospital_city || '').trim().toLowerCase();

  const eligible = allDonors.filter(d => {
    if (existingMatchedIds.has(d.id)) return false;
    return isDonorEligible(d, request, todayStr);
  });

  const withMeta = eligible.map(d => {
    const dist = getDistanceBetweenPincodes(d.pincode, reqHospPin);
    const is_exact_match = neededBlood === 'ANY'
      ? true
      : (d.blood_type || '').toUpperCase().trim() === neededBlood;
    return { ...d, distance_km: dist, match_rank: 4 as number, is_exact_match };
  });

  const sortTier = (
    a: typeof withMeta[0],
    b: typeof withMeta[0]
  ) => {
    if (a.is_exact_match !== b.is_exact_match) return a.is_exact_match ? -1 : 1;
    if (!a.cooldown_until && b.cooldown_until) return -1;
    if (a.cooldown_until && !b.cooldown_until) return 1;
    if (a.cooldown_until && b.cooldown_until) return a.cooldown_until.localeCompare(b.cooldown_until);
    return (a.updated_at || '').localeCompare(b.updated_at || '');
  };

  const isRare = ['O-', 'AB-'].includes(neededBlood);
  const result: (User & { distance_km: number; match_rank: number; is_exact_match: boolean })[] = [];
  const seen = new Set<string>();

  const addTier = (donors: typeof withMeta, rank: number) => {
    const sorted = [...donors].sort(sortTier);
    for (const d of sorted) {
      if (!seen.has(d.id)) { seen.add(d.id); result.push({ ...d, match_rank: rank }); }
    }
  };

  addTier(withMeta.filter(d => d.distance_km <= 3), 1);
  if (result.length < 3 || isRare) addTier(withMeta.filter(d => d.distance_km > 3  && d.distance_km <= 10), 2);
  if (result.length < 3 || isRare) addTier(withMeta.filter(d => d.distance_km > 10 && d.distance_km <= 25), 3);
  if (result.length < 3 || isRare) addTier(withMeta.filter(d => d.distance_km > 25), 4);
  if (result.length === 0)         addTier(withMeta, 5); // national fallback

  return result;
}


