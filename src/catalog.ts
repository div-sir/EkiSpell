import { validateCatalog, type Station, type PrintProfile } from './index.js';

export interface CatalogBundle {
  schemaVersion: 1;
  id: string;
  version: string;
  profiles: PrintProfile[];
  stations: Station[];
}
export function validateProfile(value: unknown): asserts value is PrintProfile {
  if (!value || typeof value !== 'object') throw new Error('Print profile must be an object');
  const p = value as Record<string, unknown>;
  for (const key of ['id', 'name']) if (typeof p[key] !== 'string' || !p[key].trim()) throw new Error(`Profile ${key} must be a nonempty string`);
  for (const key of ['maxRows', 'fieldCells']) if (typeof p[key] !== 'number' || !Number.isSafeInteger(p[key]) || p[key] < 1) throw new Error(`Profile ${key} must be a positive integer`);
  if (p.order !== 'oldest-first' && p.order !== 'newest-first') throw new Error('Invalid print order');
  if (p.verification !== undefined && p.verification !== 'unverified' && p.verification !== 'receipt-verified') throw new Error('Invalid profile verification');
  for (const key of ['device', 'evidence', 'observedAt']) if (p[key] !== undefined && (typeof p[key] !== 'string' || !p[key].trim())) throw new Error(`Profile ${key} must be a nonempty string`);
  if (p.verification === 'receipt-verified' && (!p.evidence || !p.device || !p.observedAt)) throw new Error('Verified profile requires device, observation date, and evidence');
  if (p.observedAt !== undefined) {
    const date = String(p.observedAt);
    const timestamp = Date.parse(date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) throw new Error('Profile observation date must be a valid YYYY-MM-DD date');
  }
}
export function validateBundle(value: unknown): asserts value is CatalogBundle {
  if (!value || typeof value !== 'object') throw new Error('Catalog bundle must be an object');
  const b = value as Record<string, unknown>;
  if (b.schemaVersion !== 1) throw new Error('Unsupported catalog schema version');
  if (typeof b.id !== 'string' || !b.id.trim() || typeof b.version !== 'string' || !b.version.trim()) throw new Error('Catalog requires ID and version');
  if (!Array.isArray(b.profiles) || b.profiles.length === 0 || b.profiles.length > 100) throw new Error('Catalog requires 1–100 profiles');
  const ids = new Set<string>();
  for (const profile of b.profiles) {
    validateProfile(profile);
    if (ids.has(profile.id)) throw new Error('Duplicate profile ID');
    ids.add(profile.id);
  }
  validateCatalog(b.stations);
  if (b.stations.length > 10000) throw new Error('Catalog exceeds 10,000 stations');
  for (const station of b.stations) for (const label of station.labels) if (!ids.has(label.profileId)) throw new Error(`Unknown profile ${label.profileId}`);
}
