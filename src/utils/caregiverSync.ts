import type {
  CaregiverShareConfig,
  CaregiverSnapshot,
  CaregiverWatchConfig,
  LogEntry,
  Medication,
} from '../types';
import { computeStreak } from './gamification';

const SHARE_KEY = 'medclock.caregiver.share.v1';
const WATCH_KEY = 'medclock.caregiver.watch.v1';
const WATCH_CACHE_KEY = 'medclock.caregiver.snapshot.v1';

const DEFAULT_SYNC_URL: string = import.meta.env.VITE_CAREGIVER_SYNC_URL || '';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCaregiverCode(length = 6): string {
  let out = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return out;
}

export function generateWriteSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPin(pin: string): Promise<string> {
  const trimmed = pin.trim();
  if (!trimmed) return '';
  const data = new TextEncoder().encode(`medclock-pin:${trimmed}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function loadShareConfig(): CaregiverShareConfig {
  try {
    const raw = localStorage.getItem(SHARE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CaregiverShareConfig>;
      if (parsed.code && parsed.writeSecret) {
        return {
          enabled: Boolean(parsed.enabled),
          code: parsed.code,
          writeSecret: parsed.writeSecret,
          patientLabel: parsed.patientLabel || 'My Meds',
          pinHash: parsed.pinHash,
          syncServerUrl: parsed.syncServerUrl ?? DEFAULT_SYNC_URL,
          lastSyncedAt: parsed.lastSyncedAt,
        };
      }
    }
  } catch {
    // Ignore parse error
  }
  return {
    enabled: false,
    code: generateCaregiverCode(6),
    writeSecret: generateWriteSecret(),
    patientLabel: 'My Meds',
    syncServerUrl: DEFAULT_SYNC_URL,
  };
}

export function saveShareConfig(cfg: CaregiverShareConfig): void {
  try {
    localStorage.setItem(SHARE_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore
  }
}

export function loadWatchConfig(): CaregiverWatchConfig | null {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    return raw ? (JSON.parse(raw) as CaregiverWatchConfig) : null;
  } catch {
    return null;
  }
}

export function saveWatchConfig(cfg: CaregiverWatchConfig | null): void {
  try {
    if (!cfg) localStorage.removeItem(WATCH_KEY);
    else localStorage.setItem(WATCH_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore
  }
}

export function loadCachedWatchedSnapshot(): CaregiverSnapshot | null {
  try {
    const raw = localStorage.getItem(WATCH_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CaregiverSnapshot) : null;
  } catch {
    return null;
  }
}

export function saveCachedWatchedSnapshot(snapshot: CaregiverSnapshot | null): void {
  try {
    if (!snapshot) localStorage.removeItem(WATCH_CACHE_KEY);
    else localStorage.setItem(WATCH_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore
  }
}

export function buildCaregiverSnapshot(
  config: CaregiverShareConfig,
  medications: Medication[],
  logs: LogEntry[],
  now = new Date()
): CaregiverSnapshot {
  const medLogs = logs.filter((l) => l.action === 'taken' || l.action === 'skipped');
  const taken = medLogs.filter((l) => l.action === 'taken').length;
  const adherencePct = medLogs.length === 0 ? 100 : Math.round((taken / medLogs.length) * 100);
  const streak = computeStreak(logs, now);

  // Strip photo flags so caregiver phone never tries to load missing local IndexedDB photos
  const cleanMeds = medications.map((m) => ({
    ...m,
    hasTabletPhoto: false,
    hasPrescriptionPhoto: false,
  }));

  return {
    version: 1,
    code: config.code,
    patientLabel: config.patientLabel.trim() || 'My Meds',
    updatedAt: now.toISOString(),
    streak,
    adherencePct,
    medications: cleanMeds,
    recentLogs: logs.slice(0, 60),
    pinHash: config.pinHash,
    writeSecret: config.writeSecret,
  };
}

export async function pushCaregiverSnapshot(
  config: CaregiverShareConfig,
  snapshot: CaregiverSnapshot
): Promise<{ ok: boolean; error?: string }> {
  const baseUrl = config.syncServerUrl.trim().replace(/\/+$/, '');
  if (!baseUrl) {
    return { ok: false, error: 'No sync server URL configured.' };
  }
  const res = await fetch(`${baseUrl}/sync/${encodeURIComponent(config.code.toUpperCase())}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: (err as { error?: string }).error || `HTTP ${res.status}` };
  }
  return { ok: true };
}

export async function fetchCaregiverSnapshot(
  watch: CaregiverWatchConfig
): Promise<{ snapshot?: CaregiverSnapshot; error?: string; pinRequired?: boolean }> {
  const baseUrl = watch.syncServerUrl.trim().replace(/\/+$/, '');
  if (!baseUrl) {
    return { error: 'Enter the sync server URL to fetch remote progress.' };
  }
  const res = await fetch(`${baseUrl}/sync/${encodeURIComponent(watch.code.toUpperCase())}`, {
    method: 'GET',
    headers: watch.pinHash ? { 'X-MedClock-Pin': watch.pinHash } : {},
  });
  const data = (await res.json().catch(() => ({}))) as Partial<CaregiverSnapshot> & {
    error?: string;
    pinRequired?: boolean;
  };
  if (!res.ok) {
    return {
      error: data.error || `HTTP ${res.status}`,
      pinRequired: Boolean(data.pinRequired),
    };
  }
  return { snapshot: data as CaregiverSnapshot };
}
