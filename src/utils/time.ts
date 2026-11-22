import type { FoodTiming, Medication } from '../types';

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toHHMM(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatTime(hhmm: string, use24Hour = false): string {
  const parts = hhmm.split(':');
  if (parts.length !== 2) return hhmm;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return hhmm;
  }
  if (use24Hour) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatTime12h(hhmm: string): string {
  return formatTime(hhmm, false);
}

export function formatDaysSummary(days: number[]): string {
  if (days.length === 0) return 'Once';
  if (days.length === 7) return 'Every day';
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.join(',') === '1,2,3,4,5') return 'Weekdays';
  if (sorted.join(',') === '0,6') return 'Weekends';
  return sorted.map((d) => DAY_LABELS[d]).join(', ');
}

export function foodTimingLabel(timing: FoodTiming): string {
  switch (timing) {
    case 'before_food':
      return 'Before Food';
    case 'after_food':
      return 'After Food';
    case 'with_food':
      return 'With Food';
    case 'anytime':
      return 'Anytime';
  }
}

/** Expand fixed or interval-based medication into daily HH:MM alarm times. */
export function getMedicationTimes(med: Medication): string[] {
  if (med.scheduleMode === 'prn') return [];
  if (med.scheduleMode === 'interval') {
    const rawHours = Number.isFinite(med.intervalHours) ? (med.intervalHours as number) : 8;
    const stepHours = Math.max(1, Math.min(12, rawHours));
    const start = med.intervalStart || '08:00';
    const [startH, startM] = start.split(':').map(Number);
    const safeH = Number.isFinite(startH) && startH >= 0 && startH <= 23 ? startH : 8;
    const safeM = Number.isFinite(startM) && startM >= 0 && startM <= 59 ? startM : 0;
    const result: string[] = [];
    for (let totalMins = safeH * 60 + safeM; totalMins < 24 * 60; totalMins += stepHours * 60) {
      const h = String(Math.floor(totalMins / 60)).padStart(2, '0');
      const m = String(totalMins % 60).padStart(2, '0');
      result.push(`${h}:${m}`);
    }
    return result;
  }
  return med.times;
}

/** Days until expiryDate (YYYY-MM-DD). Negative = already expired. */
export function daysUntilExpiry(expiryDate: string | undefined, now: Date): number | null {
  if (!expiryDate) return null;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const [y, m, d] = expiryDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  const expStart = new Date(y, m - 1, d).getTime();
  return Math.round((expStart - todayStart) / (24 * 60 * 60 * 1000));
}

/** Signed minutes from `now` until `hhmm` today (negative = overdue today). */
export function signedMinutesUntil(hhmm: string, now: Date): number {
  const [h, m] = hhmm.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  return Math.round(diffMs / 60000);
}

export function formatCountdown(totalMinutes: number): string {
  if (totalMinutes === 0) return 'Due now';
  if (totalMinutes < 0) {
    const abs = Math.abs(totalMinutes);
    const hrs = Math.floor(abs / 60);
    const mins = abs % 60;
    return hrs > 0 ? `${hrs}h ${mins}m overdue` : `${mins}m overdue`;
  }
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hrs === 0) return `in ${mins}m`;
  if (mins === 0) return `in ${hrs}h`;
  return `in ${hrs}h ${mins}m`;
}
