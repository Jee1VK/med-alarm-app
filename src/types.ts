export type FoodTiming = 'before_food' | 'after_food' | 'with_food' | 'anytime';

export type AlarmTone = 'temple_chime' | 'classic_bell' | 'urgent_pulse' | 'gentle_dawn';

export interface Medication {
  id: string;
  name: string;
  dosage: string; // e.g., "1 tablet (500 mg)"
  times: string[]; // ["08:00", "20:00"] 24h HH:MM
  days: number[]; // 0=Sun .. 6=Sat
  foodTiming: FoodTiming;
  notes?: string;
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
}

export interface AppSettings {
  defaultSnoozeMinutes: number;
  defaultVolume: number; // 0.2 .. 1.0
  keepScreenAwake: boolean;
}
