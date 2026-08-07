import { unwrapData } from '@mithra/api-client';

/** Loose JSON helpers for API → view-model mappers. */

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** Permissive envelope unwrap (accepts null/unknown service responses). */
export function unwrapEnvelope<T = unknown>(envelope: unknown): T | null {
  if (envelope == null) return null;
  return unwrapData(envelope as never) as T;
}

export function pickString(obj: Record<string, unknown>, keys: string[], fallback = '') {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v;
    if (typeof v === 'number') return String(v);
  }
  return fallback;
}

export function pickNumber(obj: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  }
  return fallback;
}

/** Unwrap list payloads that may be nested under `data`, a named key, or `content`. */
export function unwrapList(payload: unknown, keys: string[]): unknown[] {
  const root = asRecord(payload);
  const data = root.data ?? payload;
  if (Array.isArray(data)) return data;
  const obj = asRecord(data);
  for (const key of keys) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  if (Array.isArray(obj.content)) return obj.content as unknown[];
  return [];
}
