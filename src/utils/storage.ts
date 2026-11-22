import type { AppSettings, GeneralAlarm, LogEntry, Medication } from '../types';

const KEYS = {
  meds: 'medclock.medications.v1',
  alarms: 'medclock.alarms.v1',
  logs: 'medclock.logs.v1',
  settings: 'medclock.settings.v1',
  initialized: 'medclock.initialized.v1',
};

const DEFAULT_SETTINGS: AppSettings = {
  defaultSnoozeMinutes: 5,
  defaultVolume: 0.9,
  keepScreenAwake: false,
};

const SEED_MEDICATIONS: Medication[] = [
  {
    id: 'med-seed-1',
    name: 'Vitamin D3 + Calcium',
    dosage: '1 tablet (1000 IU)',
    times: ['08:30'],
    days: [0, 1, 2, 3, 4, 5, 6],
    foodTiming: 'after_food',
    notes: 'Take with a full glass of water after breakfast.',
    tone: 'temple_chime',
    enabled: true,
    trackStock: true,
    remainingDoses: 18,
    totalDoses: 30,
    dosesPerIntake: 1,
    refillThreshold: 5,
  },
  {
    id: 'med-seed-2',
    name: 'Metformin',
    dosage: '1 tablet (500 mg)',
    times: ['08:00', '20:00'],
    days: [0, 1, 2, 3, 4, 5, 6],
    foodTiming: 'before_food',
    notes: 'Take 15 minutes before meal.',
    tone: 'urgent_pulse',
    enabled: true,
    trackStock: true,
    remainingDoses: 4,
    totalDoses: 30,
    dosesPerIntake: 1,
    refillThreshold: 5,
  },
];

const SEED_ALARMS: GeneralAlarm[] = [
  {
    id: 'alarm-seed-1',
    label: 'Morning Wake-Up',
    time: '06:30',
    days: [1, 2, 3, 4, 5],
    tone: 'classic_bell',
    vibrate: true,
    enabled: true,
  },
  {
    id: 'alarm-seed-2',
    label: 'Evening Walk',
    time: '18:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    tone: 'gentle_dawn',
    vibrate: true,
    enabled: false,
  },
];

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadInitialData(): {
  medications: Medication[];
  alarms: GeneralAlarm[];
  logs: LogEntry[];
  settings: AppSettings;
} {
  const initialized = localStorage.getItem(KEYS.initialized);
  if (!initialized) {
    localStorage.setItem(KEYS.initialized, '1');
    localStorage.setItem(KEYS.meds, JSON.stringify(SEED_MEDICATIONS));
    localStorage.setItem(KEYS.alarms, JSON.stringify(SEED_ALARMS));
    localStorage.setItem(KEYS.logs, JSON.stringify([]));
    localStorage.setItem(KEYS.settings, JSON.stringify(DEFAULT_SETTINGS));
    return {
      medications: SEED_MEDICATIONS,
      alarms: SEED_ALARMS,
      logs: [],
      settings: DEFAULT_SETTINGS,
    };
  }

  return {
    medications: safeParse<Medication[]>(localStorage.getItem(KEYS.meds), []),
    alarms: safeParse<GeneralAlarm[]>(localStorage.getItem(KEYS.alarms), []),
    logs: safeParse<LogEntry[]>(localStorage.getItem(KEYS.logs), []),
    settings: {
      ...DEFAULT_SETTINGS,
      ...safeParse<Partial<AppSettings>>(localStorage.getItem(KEYS.settings), {}),
    },
  };
}

export function saveMedications(meds: Medication[]): void {
  localStorage.setItem(KEYS.meds, JSON.stringify(meds));
}

export function saveAlarms(alarms: GeneralAlarm[]): void {
  localStorage.setItem(KEYS.alarms, JSON.stringify(alarms));
}

export function saveLogs(logs: LogEntry[]): void {
  localStorage.setItem(KEYS.logs, JSON.stringify(logs));
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
