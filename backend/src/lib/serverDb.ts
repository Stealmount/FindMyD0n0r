// Server-side DB helpers — Upstash doc-store seam (Phase 3A).
// Error-swallow contract preserved: reads/deletes warn and degrade
// ([]/null/void); saveDoc warns and resolves.
import {
  getAll as storeGetAll,
  getDoc as storeGetDoc,
  saveDoc as storeSaveDoc,
  deleteDoc as storeDeleteDoc,
} from './store';
import { isUpstashConfigured } from './upstash';

export class FirebaseUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FirebaseUnavailableError';
  }
}

export function isFirebaseConfigured(): boolean {
  try {
    return isUpstashConfigured();
  } catch {
    return false;
  }
}

export function mapProfile(p: any) {
  const dp = p.donor_profile || null;
  return {
    id: p.id,
    phone: p.phone,
    whatsapp_number: p.whatsapp_number,
    email: p.email,
    full_name: p.full_name,
    blood_type: dp?.blood_group || null,
    pincode: dp?.pincode || null,
    availability_status: dp?.is_available ? 'available' : 'unavailable',
    account_status: p.trust_report_count >= 5 ? 'suspended' : 'active',
    emergency_only: dp?.emergency_only || false,
    cooldown_until: dp?.cooldown_until || null,
  };
}

export async function getCollection<T>(table: string): Promise<T[]> {
  try {
    return await storeGetAll<T>(table);
  } catch (err) {
    console.warn(`[serverDb] Upstash getCollection(${table}) error:`, (err as any)?.message || err);
    return [];
  }
}

export async function getDoc<T>(table: string, id: string): Promise<T | null> {
  try {
    return await storeGetDoc<T>(table, id);
  } catch (err) {
    console.warn(`[serverDb] Upstash getDoc(${table}, ${id}) error:`, (err as any)?.message || err);
    return null;
  }
}

export async function saveDoc(table: string, id: string, data: any): Promise<void> {
  try {
    await storeSaveDoc(table, id, data ?? {});
  } catch (err) {
    const msg = (err as any)?.message || err;
    // When Upstash is configured, a write failure is data loss — propagate so
    // callers return 503 instead of fake-201. When unconfigured (tests), degrade.
    if (isUpstashConfigured()) {
      console.error(`[serverDb] saveDoc(${table}, ${id}) write FAILED (Upstash configured):`, msg);
      throw err;
    }
    console.warn(`[serverDb] saveDoc(${table}, ${id}) skipped (no Upstash):`, msg);
  }
}

export async function deleteDoc(table: string, id: string): Promise<void> {
  try {
    await storeDeleteDoc(table, id);
  } catch (err) {
    console.warn(`[serverDb] Upstash deleteDoc(${table}, ${id}) error:`, (err as any)?.message || err);
  }
}
