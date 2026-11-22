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
import { toDateKey, toHHMM } from '../utils/time';

interface SchedulerProps {
  medications: Medication[];
  alarms: GeneralAlarm[];
  logs: LogEntry[];
  settings: AppSettings;
  onOneTimeAlarmFired: (alarmId: string) => void;
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
  const firedMinuteKeysRef = useRef<Set<string>>(new Set());

  const activeRing = ringQueue[0] ?? null;

  // Trigger audio & browser notification whenever activeRing changes
  useEffect(() => {
    if (!activeRing) {
      alarmAudio.stop();
      return;
    }

    alarmAudio.startLoop(activeRing.tone, settings.defaultVolume, activeRing.vibrate);

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const body =
          activeRing.kind === 'medication'
            ? `${activeRing.subtitle} • Scheduled for ${activeRing.scheduledTime}`
            : `Alarm • ${activeRing.scheduledTime}`;
        new Notification(activeRing.title, {
          body,
          icon: './icon.svg',
          tag: activeRing.key,
          requireInteraction: true,
        });
      } catch {
        // Notification API may throw in restricted contexts
      }
    }
  }, [activeRing, settings.defaultVolume]);

  // 1-second precision clock + alarm matcher
  useEffect(() => {
    const tick = () => {
      const current = new Date();
      setNow(current);

      const dateKey = toDateKey(current);
      const hhmm = toHHMM(current);
      const dayOfWeek = current.getDay();
      const nowMs = current.getTime();

      const dueTargets: RingingTarget[] = [];

      // 1. Check snoozed items whose wakeAtMs <= nowMs
      setSnoozed((prev) => {
        const remaining: SnoozedItem[] = [];
        for (const item of prev) {
          if (item.wakeAtMs <= nowMs) {
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
        return remaining.length !== prev.length ? remaining : prev;
      });

      // 2. Check scheduled medications
      for (const med of medications) {
        if (!med.enabled) continue;
        if (!med.days.includes(dayOfWeek)) continue;

        for (const time of med.times) {
          if (time !== hhmm) continue;
          const minuteKey = `med:${med.id}:${dateKey}:${time}`;
          if (firedMinuteKeysRef.current.has(minuteKey)) continue;

          // Skip if already logged today (taken or skipped) for this scheduled time
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

      // 3. Check general alarms
      for (const alarm of alarms) {
        if (!alarm.enabled) continue;
        const matchesDay = alarm.days.length === 0 || alarm.days.includes(dayOfWeek);
        if (!matchesDay || alarm.time !== hhmm) continue;

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
    return () => clearInterval(timer);
  }, [medications, alarms, logs, onOneTimeAlarmFired]);

  const dismissCurrentRing = () => {
    alarmAudio.stop();
    setRingQueue((prev) => prev.slice(1));
  };

  const snoozeCurrentRing = (minutes: number) => {
    if (!activeRing) return;
    alarmAudio.stop();
    const wakeAtMs = Date.now() + minutes * 60 * 1000;
    setSnoozed((prev) => [
      ...prev.filter((s) => s.key !== activeRing.key),
      {
        key: activeRing.key,
        kind: activeRing.kind,
        itemId: activeRing.itemId,
        scheduledTime: activeRing.scheduledTime,
        wakeAtMs,
      },
    ]);
    setRingQueue((prev) => prev.slice(1));
  };

  const triggerTestRing = (target: RingingTarget) => {
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
