import type { AppSettings, LogEntry, Medication } from '../types';
import { toDateKey } from './time';

interface BackupPayload {
  version: 1;
  exportedAt: string;
  medications: Medication[];
  logs: LogEntry[];
  settings: AppSettings;
  photos?: Record<string, string>;
}

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportBackupJson(
  medications: Medication[],
  logs: LogEntry[],
  settings: AppSettings,
  photos?: Record<string, string>
): void {
  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    medications,
    logs,
    settings,
    ...(photos && Object.keys(photos).length > 0 ? { photos } : {}),
  };
  downloadBlob(
    JSON.stringify(payload, null, 2),
    `medclock-backup-${toDateKey(new Date())}.json`,
    'application/json'
  );
}

export function parseBackupJson(rawText: string): BackupPayload {
  const parsed = JSON.parse(rawText) as Partial<BackupPayload>;
  if (!parsed || !Array.isArray(parsed.medications) || !Array.isArray(parsed.logs)) {
    throw new Error('Invalid MedClock backup file.');
  }

  const sanitizedMeds: Medication[] = parsed.medications
    .filter((m): m is Medication => Boolean(m && typeof m === 'object' && typeof m.id === 'string' && typeof m.name === 'string'))
    .map((m) => ({
      ...m,
      dosage: typeof m.dosage === 'string' && m.dosage.trim() ? m.dosage : '1 tablet',
      scheduleMode: m.scheduleMode ?? 'fixed',
      times: Array.isArray(m.times) && m.times.length > 0 ? m.times : ['08:00'],
      days: Array.isArray(m.days) && m.days.length > 0 ? m.days : [0, 1, 2, 3, 4, 5, 6],
      foodTiming: m.foodTiming ?? 'anytime',
      tone: m.tone ?? 'temple_chime',
      vibrate: m.vibrate ?? true,
      enabled: m.enabled ?? true,
      trackStock: Boolean(m.trackStock),
      remainingDoses: typeof m.remainingDoses === 'number' ? m.remainingDoses : 30,
      totalDoses: typeof m.totalDoses === 'number' && m.totalDoses > 0 ? m.totalDoses : 30,
      dosesPerIntake: typeof m.dosesPerIntake === 'number' && m.dosesPerIntake > 0 ? m.dosesPerIntake : 1,
      refillThreshold: typeof m.refillThreshold === 'number' ? m.refillThreshold : 5,
    }));

  const sanitizedLogs: LogEntry[] = parsed.logs.filter(
    (l): l is LogEntry =>
      Boolean(l && typeof l === 'object' && typeof l.id === 'string' && typeof l.itemId === 'string' && typeof l.dateKey === 'string')
  );

  const sanitizedPhotos: Record<string, string> = {};
  if (parsed.photos && typeof parsed.photos === 'object') {
    for (const [k, v] of Object.entries(parsed.photos)) {
      if (typeof k === 'string' && typeof v === 'string' && v.startsWith('data:image/')) {
        sanitizedPhotos[k] = v;
      }
    }
  }

  return {
    version: 1,
    exportedAt: parsed.exportedAt ?? new Date().toISOString(),
    medications: sanitizedMeds,
    logs: sanitizedLogs,
    settings: parsed.settings ?? {
      defaultSnoozeMinutes: 5,
      defaultVolume: 1.0,
      keepScreenAwake: false,
    },
    ...(Object.keys(sanitizedPhotos).length > 0 ? { photos: sanitizedPhotos } : {}),
  };
}

function escapeCsv(value: string): string {
  // Neutralize spreadsheet formula injection (=, +, -, @)
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  const needsQuotes = /[",\n\r]/.test(safe);
  const escaped = safe.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function buildHistoryCsv(logs: LogEntry[]): string {
  const header = ['Date', 'Scheduled Time', 'Medicine', 'Dosage / Details', 'Status', 'Logged At'];
  const rows = logs.map((l) => [
    l.dateKey,
    l.scheduledTime,
    l.title,
    l.subtitle,
    l.action,
    new Date(l.timestamp).toLocaleString(),
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
}

export function exportHistoryCsv(logs: LogEntry[]): void {
  downloadBlob(buildHistoryCsv(logs), `medclock-history-${toDateKey(new Date())}.csv`, 'text/csv;charset=utf-8');
}
