import type { AppSettings, LogEntry, Medication } from '../types';

const KEYS = {
  meds: 'medclock.medications.v1',
  logs: 'medclock.logs.v1',
  settings: 'medclock.settings.v1',
  initialized: 'medclock.initialized.v1',
};

const DEFAULT_SETTINGS: AppSettings = {
  defaultSnoozeMinutes: 5,
  defaultVolume: 0.9,
  keepScreenAwake: false,
};

export const SAMPLE_MEDICATIONS: Medication[] = [
  {
    id: 'med-seed-1',
    name: 'Vitamin D3 + Calcium',
    dosage: '1 tablet (1000 IU)',
    times: ['08:30'],
    days: [0, 1, 2, 3, 4, 5, 6],
    foodTiming: 'after_food',
    notes: 'Take with a full glass of water after breakfast.',
    tone: 'temple_chime',
    vibrate: true,
    enabled: true,
    trackStock: true,
    remainingDoses: 24,
    totalDoses: 30,
    dosesPerIntake: 1,
    refillThreshold: 5,
  },
  {
    id: 'med-seed-2',
    name: 'Multivitamin',
    dosage: '1 capsule',
    times: ['08:00', '20:00'],
    days: [0, 1, 2, 3, 4, 5, 6],
    foodTiming: 'after_food',
    notes: 'Morning and evening dose.',
    tone: 'gentle_dawn',
    vibrate: true,
    enabled: true,
    trackStock: true,
    remainingDoses: 28,
    totalDoses: 30,
    dosesPerIntake: 1,
    refillThreshold: 5,
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
  logs: LogEntry[];
  settings: AppSettings;
} {
  const initialized = localStorage.getItem(KEYS.initialized);
  if (!initialized) {
    localStorage.setItem(KEYS.initialized, '1');
    localStorage.setItem(KEYS.meds, JSON.stringify([]));
    localStorage.setItem(KEYS.logs, JSON.stringify([]));
    localStorage.setItem(KEYS.settings, JSON.stringify(DEFAULT_SETTINGS));
    return {
      medications: [],
      logs: [],
      settings: DEFAULT_SETTINGS,
    };
  }

  const rawMeds = safeParse<Medication[]>(localStorage.getItem(KEYS.meds), []);
  // Ensure backward compatibility for any saved meds missing `vibrate`
  const medications = rawMeds.map((m) => ({
    ...m,
    vibrate: m.vibrate ?? true,
  }));

  return {
    medications,
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

export function saveLogs(logs: LogEntry[]): void {
  localStorage.setItem(KEYS.logs, JSON.stringify(logs));
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
