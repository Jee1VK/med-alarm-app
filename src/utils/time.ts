import type { FoodTiming } from '../types';

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

export function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${period}`;
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

export function minutesUntil(hhmm: string, now: Date): number {
  const [h, m] = hhmm.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  let diffMs = target.getTime() - now.getTime();
  if (diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000;
  }
  return Math.ceil(diffMs / 60000);
}

export function formatCountdown(totalMinutes: number): string {
  if (totalMinutes <= 0) return 'Now';
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hrs === 0) return `in ${mins}m`;
  if (mins === 0) return `in ${hrs}h`;
  return `in ${hrs}h ${mins}m`;
}
