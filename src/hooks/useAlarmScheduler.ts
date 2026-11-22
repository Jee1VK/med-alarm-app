import { useEffect, useRef, useState } from 'react';
import type {
  AppSettings,
  GeneralAlarm,
  LogEntry,
  Medication,
  RingingTarget,
  SnoozedItem,
} from '../types';
import { alarmAudio } from '../utils/alarmAudio';
import { toDateKey } from '../utils/time';

interface SchedulerProps {
  medications: Medication[];
  alarms: GeneralAlarm[];
  logs: LogEntry[];
  settings: AppSettings;
  onOneTimeAlarmFired: (alarmId: string) => void;
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
  alarms,
  logs,
  settings,
  onOneTimeAlarmFired,
}: SchedulerProps) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [ringQueue, setRingQueue] = useState<RingingTarget[]>([]);
  const [snoozed, setSnoozed] = useState<SnoozedItem[]>([]);
  const snoozedRef = useRef<SnoozedItem[]>([]);
  const firedMinuteKeysRef = useRef<Set<string>>(new Set());

  const activeRing = ringQueue[0] ?? null;

  // Keep ref in sync so tick() can read snoozed items synchronously
  useEffect(() => {
    snoozedRef.current = snoozed;
  }, [snoozed]);

  // Trigger audio & browser notification whenever activeRing changes
  useEffect(() => {
    if (!activeRing) {
      alarmAudio.stop();
      return;
    }

    void alarmAudio.startLoop(activeRing.tone, settings.defaultVolume, activeRing.vibrate);

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const body =
          activeRing.kind === 'medication'
            ? `${activeRing.subtitle} • Scheduled for ${activeRing.scheduledTime}`
            : `Alarm • ${activeRing.scheduledTime}`;
        new Notification(activeRing.title, {
          body,
          icon: './icon-192.png',
          tag: activeRing.key,
          requireInteraction: true,
        });
      } catch {
        // Notification API may throw in restricted contexts
      }
    }
  }, [activeRing, settings.defaultVolume]);

  // 1-second precision clock + catch-up alarm matcher
  useEffect(() => {
    const tick = () => {
      const current = new Date();
      setNow(current);

      const dateKey = toDateKey(current);
      const dayOfWeek = current.getDay();
      const nowMs = current.getTime();

      const dueTargets: RingingTarget[] = [];

      // 1. Check snoozed items synchronously via snoozedRef
      if (snoozedRef.current.length > 0) {
        const remaining: SnoozedItem[] = [];
        let changed = false;

        for (const item of snoozedRef.current) {
          if (item.wakeAtMs <= nowMs) {
            changed = true;
            if (item.kind === 'medication') {
              const med = medications.find((m) => m.id === item.itemId);
              if (med && med.enabled) {
                dueTargets.push({
                  key: item.key,
                  kind: 'medication',
                  itemId: med.id,
                  title: med.name,
                  subtitle: med.dosage,
                  scheduledTime: item.scheduledTime,
                  tone: med.tone,
                  vibrate: true,
                  foodTiming: med.foodTiming,
                  notes: med.notes,
                  remainingDoses: med.remainingDoses,
                  refillThreshold: med.refillThreshold,
                  trackStock: med.trackStock,
                });
              }
            } else {
              const alarm = alarms.find((a) => a.id === item.itemId);
              if (alarm) {
                dueTargets.push({
                  key: item.key,
                  kind: 'alarm',
                  itemId: alarm.id,
                  title: alarm.label || 'Alarm',
                  subtitle: 'Snoozed Alarm',
                  scheduledTime: item.scheduledTime,
                  tone: alarm.tone,
                  vibrate: alarm.vibrate,
                });
              }
            }
          } else {
            remaining.push(item);
          }
        }

        if (changed) {
          snoozedRef.current = remaining;
          setSnoozed(remaining);
        }
      }

      // 2. Check scheduled medications (with 2-minute catch-up window)
      for (const med of medications) {
        if (!med.enabled) continue;
        if (!med.days.includes(dayOfWeek)) continue;

        for (const time of med.times) {
          const schedMs = scheduledTimestampForToday(current, time);
          const elapsedMs = nowMs - schedMs;
          if (elapsedMs < 0 || elapsedMs > CATCH_UP_WINDOW_MS) continue;

          const minuteKey = `med:${med.id}:${dateKey}:${time}`;
          if (firedMinuteKeysRef.current.has(minuteKey)) continue;

          const alreadyLogged = logs.some(
            (l) =>
              l.kind === 'medication' &&
              l.itemId === med.id &&
              l.dateKey === dateKey &&
              l.scheduledTime === time &&
              (l.action === 'taken' || l.action === 'skipped')
          );
          if (alreadyLogged) continue;

          firedMinuteKeysRef.current.add(minuteKey);
          dueTargets.push({
            key: `medication:${med.id}:${time}`,
            kind: 'medication',
            itemId: med.id,
            title: med.name,
            subtitle: med.dosage,
            scheduledTime: time,
            tone: med.tone,
            vibrate: true,
            foodTiming: med.foodTiming,
            notes: med.notes,
            remainingDoses: med.remainingDoses,
            refillThreshold: med.refillThreshold,
            trackStock: med.trackStock,
          });
        }
      }

      // 3. Check general alarms (with 2-minute catch-up window)
      for (const alarm of alarms) {
        if (!alarm.enabled) continue;
        const matchesDay = alarm.days.length === 0 || alarm.days.includes(dayOfWeek);
        if (!matchesDay) continue;

        const schedMs = scheduledTimestampForToday(current, alarm.time);
        const elapsedMs = nowMs - schedMs;
        if (elapsedMs < 0 || elapsedMs > CATCH_UP_WINDOW_MS) continue;

        const minuteKey = `alarm:${alarm.id}:${dateKey}:${alarm.time}`;
        if (firedMinuteKeysRef.current.has(minuteKey)) continue;

        firedMinuteKeysRef.current.add(minuteKey);
        dueTargets.push({
          key: `alarm:${alarm.id}:${alarm.time}`,
          kind: 'alarm',
          itemId: alarm.id,
          title: alarm.label || 'Alarm',
          subtitle: alarm.days.length === 0 ? 'One-time alarm' : 'Repeating alarm',
          scheduledTime: alarm.time,
          tone: alarm.tone,
          vibrate: alarm.vibrate,
        });

        if (alarm.days.length === 0) {
          onOneTimeAlarmFired(alarm.id);
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
  }, [medications, alarms, logs, onOneTimeAlarmFired]);

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
      kind: activeRing.kind,
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
