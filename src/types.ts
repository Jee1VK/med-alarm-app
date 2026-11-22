export type FoodTiming = 'before_food' | 'after_food' | 'with_food' | 'anytime';

export type AlarmTone = 'temple_chime' | 'classic_bell' | 'urgent_pulse' | 'gentle_dawn';

export type ScheduleMode = 'fixed' | 'interval' | 'prn';

export type MedColorTag = 'sky' | 'emerald' | 'amber' | 'rose' | 'indigo';

export interface Medication {
  id: string;
  name: string;
  dosage: string; // e.g., "1 tablet (500 mg)"
  scheduleMode: ScheduleMode;
  times: string[]; // ["08:00", "20:00"] 24h HH:MM (used when scheduleMode === 'fixed')
  intervalHours?: number; // e.g. 4, 6, 8, 12 (used when scheduleMode === 'interval')
  intervalStart?: string; // HH:MM (used when scheduleMode === 'interval')
  days: number[]; // 0=Sun .. 6=Sat
  foodTiming: FoodTiming;
  colorTag?: MedColorTag;
  expiryDate?: string; // YYYY-MM-DD
  notes?: string;
  hasTabletPhoto?: boolean;
  hasPrescriptionPhoto?: boolean;
  tone: AlarmTone;
  vibrate: boolean;
  enabled: boolean;
  // Refill tracking
  trackStock: boolean;
  remainingDoses: number;
  totalDoses: number;
  dosesPerIntake: number;
  refillThreshold: number;
}

export type DoseAction = 'taken' | 'skipped' | 'snoozed';

export interface LogEntry {
  id: string;
  itemId: string;
  title: string;
  subtitle: string;
  scheduledTime: string; // HH:MM
  dateKey: string; // YYYY-MM-DD
  action: DoseAction;
  timestamp: string; // ISO
}

export interface SnoozedItem {
  key: string; // `medication:${itemId}:${scheduledTime}`
  itemId: string;
  scheduledTime: string;
  wakeAtMs: number;
}

export interface RingingTarget {
  key: string;
  itemId: string;
  title: string;
  subtitle: string;
  scheduledTime: string;
  tone: AlarmTone;
  vibrate: boolean;
  foodTiming: FoodTiming;
  notes?: string;
  remainingDoses?: number;
  refillThreshold?: number;
  trackStock?: boolean;
  hasTabletPhoto?: boolean;
  isTest?: boolean;
}

export interface AppSettings {
  defaultSnoozeMinutes: number;
  defaultVolume: number; // 0.2 .. 1.0
  keepScreenAwake: boolean;
  playSuccessChime?: boolean;
}
