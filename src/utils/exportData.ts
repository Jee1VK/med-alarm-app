import type { AppSettings, LogEntry, Medication } from '../types';
import { toDateKey } from './time';

interface BackupPayload {
  version: 1;
  exportedAt: string;
  medications: Medication[];
  logs: LogEntry[];
  settings: AppSettings;
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
  settings: AppSettings
): void {
  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    medications,
    logs,
    settings,
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
  return {
    version: 1,
    exportedAt: parsed.exportedAt ?? new Date().toISOString(),
    medications: parsed.medications.map((m) => ({
      ...m,
      scheduleMode: m.scheduleMode ?? 'fixed',
      vibrate: m.vibrate ?? true,
    })),
    logs: parsed.logs,
    settings: parsed.settings ?? {
      defaultSnoozeMinutes: 5,
      defaultVolume: 0.9,
      keepScreenAwake: false,
    },
  };
}

function escapeCsv(value: string): string {
  const needsQuotes = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export function exportHistoryCsv(logs: LogEntry[]): void {
  const header = ['Date', 'Scheduled Time', 'Medicine', 'Dosage / Details', 'Status', 'Logged At'];
  const rows = logs.map((l) => [
    l.dateKey,
    l.scheduledTime,
    l.title,
    l.subtitle,
    l.action,
    new Date(l.timestamp).toLocaleString(),
  ]);
  const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
  downloadBlob(csv, `medclock-history-${toDateKey(new Date())}.csv`, 'text/csv;charset=utf-8');
}
