import type { LogEntry } from '../types';
import { toDateKey } from './time';

export const ENCOURAGING_MESSAGES = [
  'Right on time!',
  'Future you says thanks!',
  'Streak kept alive!',
  'Great consistency!',
  'One step closer to your daily goal!',
] as const;

export interface MilestoneBadge {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

/**
 * Computes consecutive days with >= 1 taken dose and 0 skipped doses.
 * Starts from today if today has activity, otherwise checks from yesterday.
 */
export function computeStreak(logs: LogEntry[], now: Date): number {
  const byDate = new Map<string, { taken: number; skipped: number }>();
  for (const l of logs) {
    if (l.action !== 'taken' && l.action !== 'skipped') continue;
    const curr = byDate.get(l.dateKey) ?? { taken: 0, skipped: 0 };
    if (l.action === 'taken') curr.taken += 1;
    else curr.skipped += 1;
    byDate.set(l.dateKey, curr);
  }

  const todayKey = toDateKey(now);
  const todayStats = byDate.get(todayKey);
  if (todayStats && todayStats.skipped > 0) return 0;

  let streak = 0;
  let startOffset = todayStats && todayStats.taken > 0 ? 0 : 1;

  for (let offset = startOffset; offset < 365; offset++) {
    const d = new Date(now);
    d.setDate(now.getDate() - offset);
    const key = toDateKey(d);
    const stats = byDate.get(key);
    if (!stats || stats.taken === 0 || stats.skipped > 0) {
      break;
    }
    streak += 1;
  }

  return streak;
}

export function getEarnedBadges(logs: LogEntry[], streak: number): MilestoneBadge[] {
  const totalTaken = logs.filter((l) => l.action === 'taken').length;
  return [
    {
      id: 'first-dose',
      title: 'First Step',
      description: 'Log your first dose taken',
      unlocked: totalTaken >= 1,
    },
    {
      id: 'streak-3',
      title: '3-Day Starter',
      description: '3 days in a row without a miss',
      unlocked: streak >= 3,
    },
    {
      id: 'streak-7',
      title: '7-Day Rhythm',
      description: 'Full week of on-time doses',
      unlocked: streak >= 7,
    },
    {
      id: 'doses-30',
      title: '30-Dose Champion',
      description: '30 total doses logged as taken',
      unlocked: totalTaken >= 30,
    },
  ];
}
