import { getCoordinates, PINCODE_COORDS } from '../data/pincode_coords';

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula. Returns distance in kilometers.
 */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1)); // round to 1 decimal place e.g. 4.2
}

/**
 * Get coordinates for a pincode and calculate distance to another pincode
 */
export function getDistanceBetweenPincodes(pinA: string, pinB: string): number {
  const normA = (pinA || '').replace(/\s+/g, '');
  const normB = (pinB || '').replace(/\s+/g, '');
  if (normA && normA === normB) return 0;
  const coordA = getCoordinates(normA);
  const coordB = getCoordinates(normB);
  const dist = haversineKm(coordA.lat, coordA.lng, coordB.lat, coordB.lng);

  // If one or both pincodes are unmapped in exact coordinates, refine proximity with prefix clamping
  if (!PINCODE_COORDS[normA] || !PINCODE_COORDS[normB]) {
    if (normA.length >= 5 && normB.length >= 5 && normA.slice(0, 5) === normB.slice(0, 5)) {
      return Math.min(dist, 2.5);
    }
    if (normA.length >= 4 && normB.length >= 4 && normA.slice(0, 4) === normB.slice(0, 4)) {
      return Math.min(dist, 6.0);
    }
  }
  return dist;
}
