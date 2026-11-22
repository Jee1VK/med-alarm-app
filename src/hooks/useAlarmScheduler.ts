import { useEffect, useRef, useState } from 'react';
import type {
  AppSettings,
  LogEntry,
  Medication,
  RingingTarget,
  SnoozedItem,
} from '../types';
import { alarmAudio } from '../utils/alarmAudio';
import { getMedicationTimes, toDateKey } from '../utils/time';

interface SchedulerProps {
  medications: Medication[];
  logs: LogEntry[];
  settings: AppSettings;
}

/** Catch-up window (ms) so browser background throttling doesn't skip an alarm. */
const CATCH_UP_WINDOW_MS = 2 * 60 * 1000;

function scheduledTimestampForToday(now: Date, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  return target.getTime();
}

export function useAlarmScheduler({
  medications,
  logs,
  settings,
}: SchedulerProps) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [ringQueue, setRingQueue] = useState<RingingTarget[]>([]);
  const [snoozed, setSnoozed] = useState<SnoozedItem[]>([]);
  const snoozedRef = useRef<SnoozedItem[]>([]);
  const firedMinuteKeysRef = useRef<Set<string>>(new Set());

  const activeRing = ringQueue[0] ?? null;

  useEffect(() => {
    snoozedRef.current = snoozed;
  }, [snoozed]);

  useEffect(() => {
    if (!activeRing) {
      alarmAudio.stop();
      return;
    }

    void alarmAudio.startLoop(activeRing.tone, settings.defaultVolume, activeRing.vibrate);

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(activeRing.title, {
          body: `${activeRing.subtitle} • Scheduled for ${activeRing.scheduledTime}`,
          icon: './icon-192.png',
          tag: activeRing.key,
          requireInteraction: true,
        });
      } catch {
        // Notification API may throw in restricted contexts
      }
    }
  }, [activeRing, settings.defaultVolume]);

  useEffect(() => {
    const isDoseLoggedForDate = (itemId: string, dateKey: string, scheduledTime: string) =>
      logs.some(
        (l) =>
          l.itemId === itemId &&
          l.dateKey === dateKey &&
          l.scheduledTime === scheduledTime &&
          (l.action === 'taken' || l.action === 'skipped')
      );

    const tick = () => {
      const current = new Date();
      setNow(current);

      const dateKey = toDateKey(current);
      const dayOfWeek = current.getDay();
      const nowMs = current.getTime();

      const dueTargets: RingingTarget[] = [];

      // 1. Check snoozed medication alarms synchronously (and prune any already taken/skipped)
      if (snoozedRef.current.length > 0) {
        const remaining: SnoozedItem[] = [];
        let changed = false;

        for (const item of snoozedRef.current) {
          const med = medications.find((m) => m.id === item.itemId);
          if (!med || !med.enabled || isDoseLoggedForDate(item.itemId, dateKey, item.scheduledTime)) {
            changed = true;
            continue;
          }

          if (item.wakeAtMs <= nowMs) {
            changed = true;
            dueTargets.push({
              key: item.key,
              itemId: med.id,
              title: med.name,
              subtitle: med.dosage,
              scheduledTime: item.scheduledTime,
              tone: med.tone,
              vibrate: med.vibrate,
              foodTiming: med.foodTiming,
              notes: med.notes,
              remainingDoses: med.remainingDoses,
              refillThreshold: med.refillThreshold,
              trackStock: med.trackStock,
            });
          } else {
            remaining.push(item);
          }
        }

        if (changed) {
          snoozedRef.current = remaining;
          setSnoozed(remaining);
        }
      }

      // 2. Check scheduled medication alarms (with 2-minute catch-up window)
      for (const med of medications) {
        if (!med.enabled || med.scheduleMode === 'prn') continue;
        if (!med.days.includes(dayOfWeek)) continue;

        for (const time of getMedicationTimes(med)) {
          const schedMs = scheduledTimestampForToday(current, time);
          const elapsedMs = nowMs - schedMs;
          if (elapsedMs < 0 || elapsedMs > CATCH_UP_WINDOW_MS) continue;

          const minuteKey = `med:${med.id}:${dateKey}:${time}`;
          if (firedMinuteKeysRef.current.has(minuteKey)) continue;

          if (isDoseLoggedForDate(med.id, dateKey, time)) continue;

          firedMinuteKeysRef.current.add(minuteKey);
          dueTargets.push({
            key: `medication:${med.id}:${time}`,
            itemId: med.id,
            title: med.name,
            subtitle: med.dosage,
            scheduledTime: time,
            tone: med.tone,
            vibrate: med.vibrate,
            foodTiming: med.foodTiming,
            notes: med.notes,
            remainingDoses: med.remainingDoses,
            refillThreshold: med.refillThreshold,
            trackStock: med.trackStock,
          });
        }
      }

      if (dueTargets.length > 0) {
        setRingQueue((prev) => {
          const existingKeys = new Set(prev.map((p) => p.key));
          const uniqueNew = dueTargets.filter((t) => !existingKeys.has(t.key));
          return uniqueNew.length > 0 ? [...prev, ...uniqueNew] : prev;
        });
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    const onResume = () => tick();
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, [medications, logs]);

  const dismissCurrentRing = () => {
    alarmAudio.stop();
    setRingQueue((prev) => prev.slice(1));
  };

  const snoozeCurrentRing = (minutes: number) => {
    if (!activeRing) return;
    alarmAudio.stop();
    const wakeAtMs = Date.now() + minutes * 60 * 1000;
    const nextItem: SnoozedItem = {
      key: activeRing.key,
      itemId: activeRing.itemId,
      scheduledTime: activeRing.scheduledTime,
      wakeAtMs,
    };
    const nextList = [...snoozedRef.current.filter((s) => s.key !== activeRing.key), nextItem];
    snoozedRef.current = nextList;
    setSnoozed(nextList);
    setRingQueue((prev) => prev.slice(1));
  };

  const triggerTestRing = (target: RingingTarget) => {
    void alarmAudio.unlock();
    setRingQueue((prev) => [target, ...prev.filter((p) => p.key !== target.key)]);
  };

  return {
    now,
    activeRing,
    ringQueueCount: ringQueue.length,
    snoozed,
    dismissCurrentRing,
    snoozeCurrentRing,
    triggerTestRing,
  };
}
