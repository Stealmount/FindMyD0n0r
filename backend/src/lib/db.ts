// Backend DB helpers — Upstash doc-store seam (Phase 3A).
// Error contract: reads/deletes log and
// degrade ([]/null/void), saveDoc logs and THROWS.
import {
  getAll as storeGetAll,
  getDoc as storeGetDoc,
  saveDoc as storeSaveDoc,
  deleteDoc as storeDeleteDoc,
} from './store';

export async function getCollection<T>(collectionName: string): Promise<T[]> {
  try {
    return await storeGetAll<T>(collectionName);
  } catch (err) {
    console.error(`Error getting collection ${collectionName}:`, err);
    return [];
  }
}

export async function getDoc<T>(collectionName: string, id: string): Promise<T | null> {
  try {
    return await storeGetDoc<T>(collectionName, id);
  } catch (err) {
    console.error(`Error getting doc ${collectionName}/${id}:`, err);
    return null;
  }
}

export async function saveDoc(collectionName: string, id: string, data: any): Promise<void> {
  try {
    // Stored payload is { ...data, id } — param id wins over
    // any id field carried inside data.
    await storeSaveDoc(collectionName, id, { ...(data ?? {}), id });
  } catch (err) {
    console.error(`Error saving doc ${collectionName}/${id}:`, err);
    throw err;
  }
}

export async function deleteDoc(collectionName: string, id: string): Promise<void> {
  try {
    await storeDeleteDoc(collectionName, id);
  } catch (err) {
    console.error(`Error deleting doc ${collectionName}/${id}:`, err);
  }
}
