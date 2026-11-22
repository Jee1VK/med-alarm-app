import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Medication, RingingTarget } from '../types';
import { foodTimingLabel, getMedicationTimes } from './time';

const ALARM_CHANNEL_ID = 'medclock_alarms';

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform();
}

/** Deterministic positive 31-bit integer ID for Android AlarmManager notifications. */
function hashNotificationId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2_000_000_000 + 1000;
}

/**
 * Initialize Android high-priority alarm channel and request notification permissions.
 * Safe no-op on web browsers.
 */
export async function initNativeAlarms(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    await LocalNotifications.createChannel({
      id: ALARM_CHANNEL_ID,
      name: 'Medication Alarms',
      description: 'High-priority reminders to take medications on time',
      importance: 5, // MAX / High priority heads-up + sound
      visibility: 1, // PUBLIC (visible on lock screen)
      vibration: true,
      lights: true,
      lightColor: '#0369A1',
    });

    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      return req.display === 'granted';
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sync all enabled medications to Android's OS AlarmManager via Capacitor LocalNotifications.
 * Alarms scheduled here ring even when MedClock is completely closed or the phone is locked.
 */
export async function syncNativeMedicationAlarms(medications: Medication[]): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    }

    const toSchedule = [];
    for (const med of medications) {
      if (!med.enabled || med.scheduleMode === 'prn') continue;
      const times = getMedicationTimes(med);
      for (const time of times) {
        const [hour, minute] = time.split(':').map(Number);
        for (const day of med.days) {
          // Capacitor weekday: 1 = Sunday .. 7 = Saturday
          const weekday = day + 1;
          const id = hashNotificationId(`${med.id}:${time}:${weekday}`);
          toSchedule.push({
            id,
            title: `Take ${med.name}`,
            body: `${med.dosage} • ${foodTimingLabel(med.foodTiming)}${med.notes ? ` — ${med.notes}` : ''}`,
            channelId: ALARM_CHANNEL_ID,
            schedule: {
              on: { weekday, hour, minute },
              allowWhileIdle: true,
              repeats: true,
            },
            extra: {
              medId: med.id,
              scheduledTime: time,
            },
          });
        }
      }
    }

    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  } catch {
    // Ignore scheduling errors if permissions denied
  }
}

/** Schedule an exact native OS snooze alarm so closing the app after snoozing still rings. */
export async function scheduleNativeSnooze(target: RingingTarget, minutes: number): Promise<void> {
  if (!isNativeAndroid()) return;
  try {
    const wakeAt = new Date(Date.now() + minutes * 60 * 1000);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: hashNotificationId(`snooze:${target.key}`),
          title: `Snoozed: ${target.title}`,
          body: `${target.subtitle} • ${foodTimingLabel(target.foodTiming)}`,
          channelId: ALARM_CHANNEL_ID,
          schedule: {
            at: wakeAt,
            allowWhileIdle: true,
          },
          extra: {
            medId: target.itemId,
            scheduledTime: target.scheduledTime,
          },
        },
      ],
    });
  } catch {
    // Ignore
  }
}
