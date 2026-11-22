import { describe, expect, it } from 'vitest';
import type { LogEntry, Medication } from '../../types';
import { buildCaregiverSnapshot, generateCaregiverCode, hashPin } from '../caregiverSync';
import { buildHistoryCsv, parseBackupJson } from '../exportData';
import { computeStreak, getEarnedBadges } from '../gamification';
import {
  daysUntilExpiry,
  formatCountdown,
  formatTime,
  formatTime12h,
  getMedicationTimes,
  signedMinutesUntil,
} from '../time';

const baseMed: Medication = {
  id: 'med-1',
  name: 'Vitamin D3',
  dosage: '1 tablet',
  scheduleMode: 'fixed',
  times: ['08:00', '20:00'],
  days: [0, 1, 2, 3, 4, 5, 6],
  foodTiming: 'after_food',
  tone: 'temple_chime',
  vibrate: true,
  enabled: true,
  trackStock: true,
  remainingDoses: 20,
  totalDoses: 30,
  dosesPerIntake: 1,
  refillThreshold: 5,
};

describe('time utilities', () => {
  it('formats 24h times into 12h AM/PM or 24h including midnight and noon', () => {
    expect(formatTime12h('00:00')).toBe('12:00 AM');
    expect(formatTime12h('12:00')).toBe('12:00 PM');
    expect(formatTime12h('18:30')).toBe('6:30 PM');
    expect(formatTime('08:05', true)).toBe('08:05');
    expect(formatTime('18:30', true)).toBe('18:30');
    expect(formatTime12h('invalid')).toBe('invalid');
  });

  it('expands interval schedules and safely guards NaN intervalHours', () => {
    expect(
      getMedicationTimes({
        ...baseMed,
        scheduleMode: 'interval',
        intervalHours: 8,
        intervalStart: '06:00',
      })
    ).toEqual(['06:00', '14:00', '22:00']);

    // Guard against NaN intervalHours (must not return empty or hang)
    expect(
      getMedicationTimes({
        ...baseMed,
        scheduleMode: 'interval',
        intervalHours: Number.NaN,
        intervalStart: '08:00',
      })
    ).toEqual(['08:00', '16:00']);
  });

  it('returns empty times for PRN medications', () => {
    expect(getMedicationTimes({ ...baseMed, scheduleMode: 'prn' })).toEqual([]);
  });

  it('computes signed overdue vs upcoming minutes accurately', () => {
    const now = new Date(2026, 10, 22, 10, 0, 0); // 10:00 AM
    expect(signedMinutesUntil('08:00', now)).toBe(-120);
    expect(signedMinutesUntil('10:00', now)).toBe(0);
    expect(signedMinutesUntil('11:30', now)).toBe(90);
    expect(formatCountdown(-120)).toBe('2h 0m overdue');
    expect(formatCountdown(90)).toBe('in 1h 30m');
  });

  it('computes daysUntilExpiry accurately for expired, today, and future dates', () => {
    const now = new Date(2026, 10, 22, 15, 0, 0); // 2026-11-22
    expect(daysUntilExpiry('2026-11-20', now)).toBe(-2);
    expect(daysUntilExpiry('2026-11-22', now)).toBe(0);
    expect(daysUntilExpiry('2026-11-30', now)).toBe(8);
  });
});

describe('gamification (streaks & badges)', () => {
  const makeLog = (dateKey: string, action: 'taken' | 'skipped'): LogEntry => ({
    id: `${dateKey}-${action}`,
    itemId: 'med-1',
    title: 'Vitamin D3',
    subtitle: '1 tablet',
    scheduledTime: '08:00',
    dateKey,
    action,
    timestamp: new Date().toISOString(),
  });

  it('computes consecutive day streaks and breaks on skipped doses', () => {
    const now = new Date(2026, 10, 22, 12, 0, 0); // 2026-11-22
    const logs = [
      makeLog('2026-11-22', 'taken'),
      makeLog('2026-11-21', 'taken'),
      makeLog('2026-11-20', 'taken'),
    ];
    expect(computeStreak(logs, now)).toBe(3);

    const badges = getEarnedBadges(logs, 3);
    expect(badges.find((b) => b.id === 'first-dose')?.unlocked).toBe(true);
    expect(badges.find((b) => b.id === 'streak-3')?.unlocked).toBe(true);
    expect(badges.find((b) => b.id === 'streak-7')?.unlocked).toBe(false);

    // Adding a skipped dose today breaks streak to 0
    expect(computeStreak([...logs, makeLog('2026-11-22', 'skipped')], now)).toBe(0);
  });
});

describe('backup & CSV security', () => {
  it('sanitizes malformed backup entries instead of crashing', () => {
    const corrupted = JSON.stringify({
      version: 1,
      medications: [null, { id: 'm1', name: 'Aspirin' }],
      logs: [null, { id: 'l1', itemId: 'm1', title: 'Aspirin', action: 'taken', dateKey: '2026-11-22', scheduledTime: '08:00', subtitle: '1 tab', timestamp: '2026-11-22T08:00:00Z' }],
    });
    const parsed = parseBackupJson(corrupted);
    expect(parsed.medications).toHaveLength(1);
    expect(parsed.medications[0].times).toEqual(['08:00']);
    expect(parsed.medications[0].days).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(parsed.logs).toHaveLength(1);
  });

  it('neutralizes CSV formula injection characters (=, +, -, @)', () => {
    const csv = buildHistoryCsv([
      {
        id: '1',
        itemId: 'm1',
        title: '=CMD|calc',
        subtitle: '+500mg',
        scheduledTime: '08:00',
        dateKey: '2026-11-22',
        action: 'taken',
        timestamp: '2026-11-22T08:00:00Z',
      },
    ]);
    expect(csv).toContain("'=CMD|calc");
    expect(csv).toContain("'+500mg");
  });
});

describe('caregiver sync utilities', () => {
  it('generates 6-character unambiguous uppercase codes and deterministic PIN hashes', async () => {
    const code = generateCaregiverCode(6);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const h1 = await hashPin('1234');
    const h2 = await hashPin(' 1234 ');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(await hashPin('')).toBe('');
  });

  it('strips local photo flags when building caregiver snapshots', () => {
    const snap = buildCaregiverSnapshot(
      {
        enabled: true,
        code: 'K7M9P2',
        writeSecret: 'secret',
        patientLabel: 'Dad',
        syncServerUrl: 'https://example.workers.dev',
      },
      [{ ...baseMed, hasTabletPhoto: true, hasPrescriptionPhoto: true }],
      []
    );
    expect(snap.patientLabel).toBe('Dad');
    expect(snap.medications[0].hasTabletPhoto).toBe(false);
    expect(snap.medications[0].hasPrescriptionPhoto).toBe(false);
  });
});
