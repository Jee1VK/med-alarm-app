import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Medication, RingingTarget } from '../types';
import { foodTimingLabel, getMedicationTimes } from './time';

// v3 channel registers the new loud 3-minute custom alarm WAV at MAX importance
const ALARM_CHANNEL_ID = 'medclock_alarms_v3';
const ALARM_SOUND_FILE = 'medclock_alarm.wav';

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform();
}

function hashNotificationId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 2_000_000_000) + 1000;
}

/**
 * Initialize Android high-priority alarm channel with custom loud WAV ringtone
 * and request notification permissions. Safe no-op on web browsers.
 */
export async function initNativeAlarms(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    await LocalNotifications.createChannel({
      id: ALARM_CHANNEL_ID,
      name: 'MedClock Loud Alarms',
      description: 'High-priority medication alarms that ring even when the app is closed',
      importance: 5, // IMPORTANCE_HIGH -> heads-up banner + sound
      visibility: 1, // VISIBILITY_PUBLIC -> show on lock screen
      sound: ALARM_SOUND_FILE,
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
 * Sync all enabled medications to Android's OS AlarmManager using exact `at` timestamps
 * for the next 7 days (far more reliable across Android 12-15 than `on.weekday`).
 * Returns the number of scheduled OS alarms.
 */
export async function syncNativeMedicationAlarms(medications: Medication[]): Promise<number> {
  if (!isNativeAndroid()) return 0;

  const granted = await initNativeAlarms();
  if (!granted) return 0;

  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    }

    const now = new Date();
    const toSchedule = [];

    // Schedule exact AlarmManager alerts for the next 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDay = new Date(now);
      targetDay.setDate(now.getDate() + dayOffset);
      const dow = targetDay.getDay();

      for (const med of medications) {
        if (!med.enabled || med.scheduleMode === 'prn') continue;
        if (!med.days.includes(dow)) continue;

        for (const time of getMedicationTimes(med)) {
          const [hour, minute] = time.split(':').map(Number);
          const fireAt = new Date(
            targetDay.getFullYear(),
            targetDay.getMonth(),
            targetDay.getDate(),
            hour,
            minute,
            0,
            0
          );

          // Only schedule future alarms (at least 2 seconds from now)
          if (fireAt.getTime() <= now.getTime() + 2000) continue;

          const id = hashNotificationId(`${med.id}:${fireAt.toISOString().slice(0, 16)}`);
          toSchedule.push({
            id,
            title: `Time for ${med.name}`,
            body: `${med.dosage} • ${foodTimingLabel(med.foodTiming)}${med.notes ? ` — ${med.notes}` : ''}`,
            channelId: ALARM_CHANNEL_ID,
            sound: ALARM_SOUND_FILE,
            schedule: {
              at: fireAt,
              allowWhileIdle: true,
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
      // Android limits ~500 pending alarms; cap safely at 60 upcoming alarms
      const batch = toSchedule
        .sort((a, b) => a.schedule.at.getTime() - b.schedule.at.getTime())
        .slice(0, 60);
      await LocalNotifications.schedule({ notifications: batch });
      return batch.length;
    }
    return 0;
  } catch {
    return 0;
  }
}

/** Schedule a 5-second test native Android alarm so the user can lock the screen and verify it rings. */
export async function scheduleNativeTestAlarm(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  const granted = await initNativeAlarms();
  if (!granted) return false;
  try {
    const fireAt = new Date(Date.now() + 5000);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: hashNotificationId(`native-test-${Date.now()}`),
          title: 'MedClock Test Alarm',
          body: 'Background & closed-app Android alarms are working!',
          channelId: ALARM_CHANNEL_ID,
          sound: ALARM_SOUND_FILE,
          schedule: {
            at: fireAt,
            allowWhileIdle: true,
          },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

/** Schedule an exact native OS snooze alarm so closing the app after snoozing still rings. */
export async function scheduleNativeSnooze(target: RingingTarget, minutes: number): Promise<void> {
  if (!isNativeAndroid()) return;
  const granted = await initNativeAlarms();
  if (!granted) return;
  try {
    const wakeAt = new Date(Date.now() + minutes * 60 * 1000);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: hashNotificationId(`snooze:${target.key}`),
          title: `Snoozed: ${target.title}`,
          body: `${target.subtitle} • ${foodTimingLabel(target.foodTiming)}`,
          channelId: ALARM_CHANNEL_ID,
          sound: ALARM_SOUND_FILE,
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
