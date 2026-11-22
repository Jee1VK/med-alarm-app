import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellRing,
  CalendarClock,
  Check,
  Download,
  FileSpreadsheet,
  History,
  Moon,
  Pencil,
  Pill,
  Plus,
  RefreshCw,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { MedicationModal } from './components/MedicationModal';
import { RingingModal } from './components/RingingModal';
import { useAlarmScheduler } from './hooks/useAlarmScheduler';
import type { AppSettings, LogEntry, Medication, RingingTarget } from './types';
import { alarmAudio } from './utils/alarmAudio';
import { exportBackupJson, exportHistoryCsv, parseBackupJson } from './utils/exportData';
import {
  SAMPLE_MEDICATIONS,
  createId,
  loadInitialData,
  saveLogs,
  saveMedications,
  saveSettings,
} from './utils/storage';
import {
  DAY_LABELS,
  daysUntilExpiry,
  foodTimingLabel,
  formatCountdown,
  formatDaysSummary,
  formatTime12h,
  getMedicationTimes,
  signedMinutesUntil,
  toDateKey,
  toHHMM,
} from './utils/time';

type Tab = 'today' | 'medications' | 'history';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function App() {
  const initial = useMemo(() => loadInitialData(), []);

  const [tab, setTab] = useState<Tab>('today');
  const [medications, setMedications] = useState<Medication[]>(initial.medications);
  const [logs, setLogs] = useState<LogEntry[]>(initial.logs);
  const [settings, setSettings] = useState<AppSettings>(initial.settings);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('medclock.theme.v1');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [confirmClearLog, setConfirmClearLog] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() =>
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
  const [showIosInstallTip, setShowIosInstallTip] = useState(false);

  const [medModalOpen, setMedModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => saveMedications(medications), [medications]);
  useEffect(() => saveLogs(logs), [logs]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('medclock.theme.v1', theme);
  }, [theme]);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsStandalone(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null);
      }
      return;
    }
    setShowIosInstallTip((prev) => !prev);
  };

  const {
    now,
    activeRing,
    ringQueueCount,
    snoozed,
    dismissCurrentRing,
    snoozeCurrentRing,
    triggerTestRing,
  } = useAlarmScheduler({
    medications,
    logs,
    settings,
  });

  const todayKey = toDateKey(now);
  const todayDow = now.getDay();

  useEffect(() => {
    const unlockOnce = async () => {
      const ok = await alarmAudio.unlock();
      if (ok) {
        setAudioUnlocked(true);
        window.removeEventListener('pointerdown', unlockOnce);
      }
    };
    window.addEventListener('pointerdown', unlockOnce, { passive: true });
    return () => window.removeEventListener('pointerdown', unlockOnce);
  }, []);

  const handleUnlockAndTestAudio = async () => {
    const ok = await alarmAudio.unlock();
    setAudioUnlocked(ok);
    void alarmAudio.preview('temple_chime', settings.defaultVolume);
  };

  const handleRequestNotifications = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  const logAction = (
    itemId: string,
    title: string,
    subtitle: string,
    scheduledTime: string,
    action: LogEntry['action']
  ) => {
    const entry: LogEntry = {
      id: createId('log'),
      itemId,
      title,
      subtitle,
      scheduledTime,
      dateKey: todayKey,
      action,
      timestamp: new Date().toISOString(),
    };
    setLogs((prev) => [entry, ...prev].slice(0, 300));
  };

  const markMedicationTaken = (med: Medication, scheduledTime: string, isExtra = false) => {
    logAction(
      med.id,
      med.name,
      isExtra ? `${med.dosage} (Extra / As Needed)` : med.dosage,
      scheduledTime,
      'taken'
    );
    if (med.trackStock) {
      setMedications((prev) =>
        prev.map((m) =>
          m.id === med.id
            ? { ...m, remainingDoses: Math.max(0, m.remainingDoses - m.dosesPerIntake) }
            : m
        )
      );
    }
  };

  const undoTodayDose = (med: Medication, scheduledTime: string, wasTaken: boolean) => {
    setLogs((prev) =>
      prev.filter(
        (l) =>
          !(
            l.itemId === med.id &&
            l.dateKey === todayKey &&
            l.scheduledTime === scheduledTime &&
            (l.action === 'taken' || l.action === 'skipped')
          )
      )
    );
    if (wasTaken && med.trackStock) {
      setMedications((prev) =>
        prev.map((m) =>
          m.id === med.id
            ? { ...m, remainingDoses: Math.min(m.totalDoses, m.remainingDoses + m.dosesPerIntake) }
            : m
        )
      );
    }
  };

  const handleRingMarkTaken = (target: RingingTarget) => {
    const med = medications.find((m) => m.id === target.itemId);
    if (med) {
      markMedicationTaken(med, target.scheduledTime);
    }
    dismissCurrentRing();
  };

  const handleRingSkipMed = (target: RingingTarget) => {
    logAction(target.itemId, target.title, target.subtitle, target.scheduledTime, 'skipped');
    dismissCurrentRing();
  };

  const handleRingSnooze = (minutes: number) => {
    if (activeRing) {
      logAction(
        activeRing.itemId,
        activeRing.title,
        `${activeRing.subtitle} (Snoozed ${minutes}m)`,
        activeRing.scheduledTime,
        'snoozed'
      );
    }
    snoozeCurrentRing(minutes);
  };

  const handleRestoreFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const restored = parseBackupJson(text);
      setMedications(restored.medications);
      setLogs(restored.logs);
      setSettings(restored.settings);
      setRestoreStatus(`Restored ${restored.medications.length} medicine(s) and ${restored.logs.length} log entries.`);
    } catch {
      setRestoreStatus('Could not restore: invalid MedClock JSON backup file.');
    } finally {
      e.target.value = '';
    }
  };

  // Today's chronological scheduled medication alarms
  const todaySchedule = useMemo(() => {
    const rows: {
      key: string;
      time: string;
      med: Medication;
      status: 'pending' | 'taken' | 'skipped';
    }[] = [];

    for (const med of medications) {
      if (!med.enabled || med.scheduleMode === 'prn' || !med.days.includes(todayDow)) continue;
      for (const t of getMedicationTimes(med)) {
        const log = logs.find(
          (l) =>
            l.itemId === med.id &&
            l.dateKey === todayKey &&
            l.scheduledTime === t &&
            (l.action === 'taken' || l.action === 'skipped')
        );
        rows.push({
          key: `med-${med.id}-${t}`,
          time: t,
          med,
          status: log ? (log.action === 'taken' ? 'taken' : 'skipped') : 'pending',
        });
      }
    }

    return rows.sort((a, b) => a.time.localeCompare(b.time));
  }, [medications, logs, todayDow, todayKey]);

  const prnMeds = useMemo(
    () => medications.filter((m) => m.enabled && m.scheduleMode === 'prn'),
    [medications]
  );

  const nextUpcoming = useMemo(() => {
    const pending = todaySchedule
      .filter((row) => row.status === 'pending')
      .map((row) => ({
        title: row.med.name,
        time: row.time,
        mins: signedMinutesUntil(row.time, now),
      }));

    const upcoming = pending.filter((p) => p.mins >= 0).sort((a, b) => a.mins - b.mins);
    if (upcoming.length > 0) {
      return { kind: 'upcoming' as const, item: upcoming[0], overdueCount: pending.length - upcoming.length };
    }
    const overdue = pending.filter((p) => p.mins < 0).sort((a, b) => b.mins - a.mins);
    if (overdue.length > 0) {
      return { kind: 'overdue' as const, item: overdue[0], overdueCount: overdue.length };
    }
    return null;
  }, [todaySchedule, now]);

  const lowStockMeds = useMemo(
    () => medications.filter((m) => m.trackStock && m.remainingDoses <= m.refillThreshold),
    [medications]
  );

  const expiringMeds = useMemo(
    () =>
      medications
        .map((m) => ({ med: m, daysLeft: daysUntilExpiry(m.expiryDate, now) }))
        .filter((x): x is { med: Medication; daysLeft: number } => x.daysLeft !== null && x.daysLeft <= 14),
    [medications, now]
  );

  const adherenceStats = useMemo(() => {
    const medLogs = logs.filter((l) => l.action === 'taken' || l.action === 'skipped');
    const taken = medLogs.filter((l) => l.action === 'taken').length;
    const skipped = medLogs.filter((l) => l.action === 'skipped').length;
    const total = taken + skipped;
    const pct = total === 0 ? 100 : Math.round((taken / total) * 100);
    return { taken, skipped, total, pct };
  }, [logs]);

  // Last 7 days visual adherence strip
  const weekStrip = useMemo(() => {
    const days: { dateKey: string; label: string; dayNum: number; status: 'good' | 'partial' | 'missed' | 'none' }[] = [];
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(now);
      d.setDate(now.getDate() - offset);
      const key = toDateKey(d);
      const dayLogs = logs.filter((l) => l.dateKey === key && (l.action === 'taken' || l.action === 'skipped'));
      const taken = dayLogs.filter((l) => l.action === 'taken').length;
      const skipped = dayLogs.filter((l) => l.action === 'skipped').length;
      let status: 'good' | 'partial' | 'missed' | 'none' = 'none';
      if (taken + skipped > 0) {
        if (skipped === 0) status = 'good';
        else if (taken > 0) status = 'partial';
        else status = 'missed';
      }
      days.push({
        dateKey: key,
        label: DAY_LABELS[d.getDay()],
        dayNum: d.getDate(),
        status,
      });
    }
    return days;
  }, [logs, now]);

  const formattedClock = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const formattedDate = now.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const navItems: { id: Tab; label: string; icon: typeof CalendarClock }[] = [
    { id: 'today', label: 'Today', icon: CalendarClock },
    { id: 'medications', label: 'Medications', icon: Pill },
    { id: 'history', label: 'History', icon: History },
  ];

  const takenTodayCount = todaySchedule.filter((r) => r.status === 'taken').length;
  const progressPct =
    todaySchedule.length === 0 ? 0 : Math.round((takenTodayCount / todaySchedule.length) * 100);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark" style={{ overflow: 'hidden', background: 'transparent' }} aria-hidden="true">
            <img
              src="./logo.png"
              alt=""
              width={42}
              height={42}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div>
            <h1 className="brand-title">MedClock</h1>
            <p className="brand-subtitle">Medication Reminders &amp; Linked Alarms</p>
          </div>
        </div>

        <div className="header-actions">
          {!isStandalone && (
            <button type="button" className="btn btn--primary btn--sm" onClick={handleInstallApp}>
              <Download size={16} aria-hidden="true" /> Install App
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            aria-label={theme === 'dark' ? 'Switch to Daylight Mode' : 'Switch to Bedside Night Mode'}
            title={theme === 'dark' ? 'Daylight Mode' : 'Bedside Night Mode'}
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>

          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => {
              setAudioUnlocked(true);
              triggerTestRing({
                key: `test-${Date.now()}`,
                itemId: 'test',
                title: 'Test Medication Alarm',
                subtitle: '1 tablet • Sound & Snooze Check',
                scheduledTime: toHHMM(now),
                tone: 'temple_chime',
                vibrate: true,
                foodTiming: 'after_food',
              });
            }}
          >
            <BellRing size={16} aria-hidden="true" /> Test Alarm
          </button>
        </div>
      </header>

      <nav className="desktop-nav" aria-label="Main navigation">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className="nav-btn"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* TODAY TAB */}
      {tab === 'today' && (
        <main>
          {showIosInstallTip && !isStandalone && (
            <div className="banner banner--info" role="status">
              <span>
                <strong>Install on your device:</strong> On iPhone/iPad Safari tap{' '}
                <strong>Share → Add to Home Screen</strong>. On Chrome/Edge desktop or Android, use the
                browser menu <strong>Install MedClock</strong>.
              </span>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setShowIosInstallTip(false)}
              >
                Got it
              </button>
            </div>
          )}

          <section className="hero-clock-card" aria-label="Live clock and next dose">
            <div>
              <div className="hero-time tabular-nums">{formattedClock}</div>
              <div className="hero-date">{formattedDate}</div>
            </div>
            <div className="hero-next-pill">
              <div className="hero-next-label">
                {nextUpcoming?.kind === 'overdue' ? 'Overdue Dose' : 'Next Dose Alarm'}
              </div>
              {nextUpcoming ? (
                <div className="hero-next-value">
                  {nextUpcoming.item.title} •{' '}
                  <span className="tabular-nums">{formatTime12h(nextUpcoming.item.time)}</span> (
                  {formatCountdown(nextUpcoming.item.mins)})
                  {nextUpcoming.overdueCount > 0 && nextUpcoming.kind === 'upcoming'
                    ? ` • ${nextUpcoming.overdueCount} overdue`
                    : ''}
                </div>
              ) : (
                <div className="hero-next-value">
                  {todaySchedule.length === 0 ? 'No doses scheduled today' : 'All doses completed for today'}
                </div>
              )}
            </div>
          </section>

          {todaySchedule.length > 0 && (
            <section className="progress-card" aria-label="Today's medication progress">
              <div className="progress-header">
                <span>Today&apos;s Medication Progress</span>
                <span className="tabular-nums" style={{ color: 'var(--color-brand-secondary)' }}>
                  {takenTodayCount} / {todaySchedule.length} taken ({progressPct}%)
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </section>
          )}

          {!audioUnlocked && (
            <div className="banner banner--warning" role="status">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Volume2 size={18} aria-hidden="true" />
                <span>Tap once to unlock loud alarm audio in your browser.</span>
              </div>
              <button type="button" className="btn btn--primary btn--sm" onClick={handleUnlockAndTestAudio}>
                Enable Sound
              </button>
            </div>
          )}

          {notifPermission === 'default' && (
            <div className="banner banner--info" role="status">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Bell size={18} aria-hidden="true" />
                <span>Allow browser notifications for background medication alerts.</span>
              </div>
              <button type="button" className="btn btn--secondary btn--sm" onClick={handleRequestNotifications}>
                Allow Notifications
              </button>
            </div>
          )}

          {snoozed.length > 0 && (
            <div className="banner banner--warning" role="status">
              <div>
                <strong>Snoozed ({snoozed.length}):</strong>{' '}
                {snoozed
                  .map((s) => {
                    const minsLeft = Math.max(1, Math.ceil((s.wakeAtMs - now.getTime()) / 60000));
                    return `${formatTime12h(s.scheduledTime)} (${minsLeft}m left)`;
                  })
                  .join(', ')}
              </div>
            </div>
          )}

          {lowStockMeds.length > 0 && (
            <div className="banner banner--warning" role="alert">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={18} aria-hidden="true" />
                <span>
                  <strong>Refill Needed:</strong>{' '}
                  {lowStockMeds.map((m) => `${m.name} (${m.remainingDoses} left)`).join(', ')}
                </span>
              </div>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setTab('medications')}
              >
                Manage Stock
              </button>
            </div>
          )}

          {expiringMeds.length > 0 && (
            <div className="banner banner--warning" role="alert">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={18} aria-hidden="true" />
                <span>
                  <strong>Expiry Alert:</strong>{' '}
                  {expiringMeds
                    .map(({ med, daysLeft }) =>
                      daysLeft < 0
                        ? `${med.name} (expired)`
                        : daysLeft === 0
                          ? `${med.name} (expires today)`
                          : `${med.name} (expires in ${daysLeft}d)`
                    )
                    .join(', ')}
                </span>
              </div>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setTab('medications')}
              >
                Check Meds
              </button>
            </div>
          )}

          <div className="section-header">
            <h2 className="section-title">Today&apos;s Medication Alarms</h2>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => {
                setEditingMed(null);
                setMedModalOpen(true);
              }}
            >
              <Plus size={16} aria-hidden="true" /> Add Medicine
            </button>
          </div>

          {todaySchedule.length === 0 ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                No medications scheduled for today. Tap <strong>Add Medicine</strong> to set up a medicine and its linked alarm times.
              </p>
              {medications.length === 0 && (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setMedications(SAMPLE_MEDICATIONS)}
                >
                  Load Sample Schedule
                </button>
              )}
            </div>
          ) : (
            <div className="stack">
              {todaySchedule.map(({ key, time, med, status }) => {
                const isOverdue = status === 'pending' && signedMinutesUntil(time, now) < 0;
                const tag = med.colorTag ?? 'sky';
                return (
                  <article
                    key={key}
                    data-tag={tag}
                    className={`item-card ${status !== 'pending' ? 'item-card--done' : ''}`}
                  >
                    <div className="item-meta">
                      <div className="item-title-row">
                        <span className={`tag-dot tag-dot--${tag}`} aria-hidden="true" />
                        <span
                          className="tabular-nums"
                          style={{ fontWeight: 700, color: 'var(--color-brand-primary)' }}
                        >
                          {formatTime12h(time)}
                        </span>
                        <h3 className="item-title">{med.name}</h3>
                        <span className="badge badge--gold">{foodTimingLabel(med.foodTiming)}</span>
                        {isOverdue && <span className="badge badge--red">Overdue</span>}
                        {status === 'taken' && <span className="badge badge--green">Taken</span>}
                        {status === 'skipped' && <span className="badge badge--red">Skipped</span>}
                      </div>
                      <div className="item-sub">{med.dosage}</div>
                    </div>

                    {status === 'pending' ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn--success btn--sm"
                          onClick={() => markMedicationTaken(med, time)}
                        >
                          <Check size={16} aria-hidden="true" /> Take
                        </button>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          onClick={() => logAction(med.id, med.name, med.dosage, time, 'skipped')}
                        >
                          Skip
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => undoTodayDose(med, time, status === 'taken')}
                      >
                        <RotateCcw size={15} aria-hidden="true" /> Undo
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {prnMeds.length > 0 && (
            <>
              <div className="section-header">
                <h2 className="section-title">As Needed (PRN)</h2>
              </div>
              <div className="stack">
                {prnMeds.map((med) => {
                  const tag = med.colorTag ?? 'sky';
                  return (
                    <article key={med.id} data-tag={tag} className="item-card">
                      <div className="item-meta">
                        <div className="item-title-row">
                          <span className={`tag-dot tag-dot--${tag}`} aria-hidden="true" />
                          <h3 className="item-title">{med.name}</h3>
                          <span className="badge badge--blue">As Needed</span>
                          <span className="badge badge--gold">{foodTimingLabel(med.foodTiming)}</span>
                        </div>
                        <div className="item-sub">{med.dosage}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn--success btn--sm"
                        onClick={() => markMedicationTaken(med, toHHMM(now), true)}
                      >
                        <Plus size={15} aria-hidden="true" /> Log Dose
                      </button>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </main>
      )}

      {/* MEDICATIONS TAB */}
      {tab === 'medications' && (
        <main>
          <div className="section-header">
            <h2 className="section-title">Medications &amp; Alarms</h2>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => {
                setEditingMed(null);
                setMedModalOpen(true);
              }}
            >
              <Plus size={16} aria-hidden="true" /> Add Medicine
            </button>
          </div>

          {medications.length === 0 ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                No medications added yet. Tap <strong>Add Medicine</strong> to set up your medicine and its linked alarm.
              </p>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setMedications(SAMPLE_MEDICATIONS)}
              >
                Load Sample Schedule
              </button>
            </div>
          ) : (
            <div className="stack">
              {medications.map((med) => {
                const isLow = med.trackStock && med.remainingDoses <= med.refillThreshold;
                const expDays = daysUntilExpiry(med.expiryDate, now);
                const stockPct =
                  med.totalDoses > 0 ? Math.min(100, (med.remainingDoses / med.totalDoses) * 100) : 0;
                const tag = med.colorTag ?? 'sky';
                const expandedTimes = getMedicationTimes(med);

                return (
                  <article
                    key={med.id}
                    data-tag={tag}
                    className={`item-card ${!med.enabled ? 'item-card--dim' : ''}`}
                  >
                    <div className="item-meta">
                      <div className="item-title-row">
                        <span className={`tag-dot tag-dot--${tag}`} aria-hidden="true" />
                        <h3 className="item-title">{med.name}</h3>
                        <span className="badge badge--gold">{foodTimingLabel(med.foodTiming)}</span>
                        {isLow && <span className="badge badge--red">Refill Low</span>}
                        {expDays !== null && expDays <= 14 && (
                          <span className="badge badge--red">
                            {expDays < 0 ? 'Expired' : expDays === 0 ? 'Expires Today' : `Expires in ${expDays}d`}
                          </span>
                        )}
                      </div>
                      <div className="item-sub">
                        {med.dosage} •{' '}
                        {med.scheduleMode === 'prn' ? (
                          <span>As Needed (No Alarm)</span>
                        ) : (
                          <>
                            <span className="tabular-nums">
                              {expandedTimes.map((t) => formatTime12h(t)).join(', ')}
                            </span>{' '}
                            {med.scheduleMode === 'interval' ? `(Every ${med.intervalHours}h) ` : ''}•{' '}
                            {formatDaysSummary(med.days)}
                          </>
                        )}
                      </div>
                      {med.trackStock && (
                        <div style={{ marginTop: 4 }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                            Stock: <strong className="tabular-nums">{med.remainingDoses}</strong> /{' '}
                            <span className="tabular-nums">{med.totalDoses}</span> doses left
                          </div>
                          <div className="stock-bar-track">
                            <div
                              className={`stock-bar-fill ${isLow ? 'stock-bar-fill--low' : ''}`}
                              style={{ width: `${stockPct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn--success btn--sm"
                        title="Log 1 extra dose taken now"
                        onClick={() => markMedicationTaken(med, toHHMM(now), true)}
                      >
                        <Plus size={14} aria-hidden="true" /> +1 Taken
                      </button>
                      {med.trackStock && (
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          title="Add 30 doses to stock"
                          onClick={() =>
                            setMedications((prev) =>
                              prev.map((m) =>
                                m.id === med.id
                                  ? {
                                      ...m,
                                      remainingDoses: m.remainingDoses + 30,
                                      totalDoses: Math.max(m.totalDoses, m.remainingDoses + 30),
                                    }
                                  : m
                              )
                            )
                          }
                        >
                          <RefreshCw size={14} aria-hidden="true" /> +30
                        </button>
                      )}
                      {med.scheduleMode !== 'prn' && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Test alarm for ${med.name}`}
                          title={`Test alarm for ${med.name}`}
                          onClick={() => {
                            setAudioUnlocked(true);
                            triggerTestRing({
                              key: `med-test-${med.id}-${Date.now()}`,
                              itemId: med.id,
                              title: med.name,
                              subtitle: med.dosage,
                              scheduledTime: expandedTimes[0] ?? '08:00',
                              tone: med.tone,
                              vibrate: med.vibrate,
                              foodTiming: med.foodTiming,
                              notes: med.notes,
                            });
                          }}
                        >
                          <BellRing size={17} aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Edit ${med.name}`}
                        onClick={() => {
                          setEditingMed(med);
                          setMedModalOpen(true);
                        }}
                      >
                        <Pencil size={17} aria-hidden="true" />
                      </button>
                      {confirmDeleteId === med.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn--danger btn--sm"
                            onClick={() => {
                              setMedications((prev) => prev.filter((m) => m.id !== med.id));
                              setConfirmDeleteId(null);
                            }}
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Delete ${med.name}`}
                          onClick={() => setConfirmDeleteId(med.id)}
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      )}
                      <label className="switch-wrap" aria-label={`Enable alarm for ${med.name}`}>
                        <input
                          className="switch-input"
                          type="checkbox"
                          checked={med.enabled}
                          onChange={() =>
                            setMedications((prev) =>
                              prev.map((m) => (m.id === med.id ? { ...m, enabled: !m.enabled } : m))
                            )
                          }
                        />
                      </label>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <main>
          <div className="section-header">
            <h2 className="section-title">Adherence &amp; History</h2>
            {logs.length > 0 &&
              (confirmClearLog ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => {
                      setLogs([]);
                      setConfirmClearLog(false);
                    }}
                  >
                    Confirm Clear
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setConfirmClearLog(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => setConfirmClearLog(true)}
                >
                  Clear Log
                </button>
              ))}
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  Medication Adherence Rate
                </div>
                <div
                  className="tabular-nums"
                  style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-brand-primary)' }}
                >
                  {adherenceStats.pct}%
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.9rem' }}>
                <div>
                  <strong className="tabular-nums">{adherenceStats.taken}</strong> Taken
                </div>
                <div>
                  <strong className="tabular-nums">{adherenceStats.skipped}</strong> Skipped
                </div>
              </div>
            </div>

            <div className="week-strip" aria-label="Last 7 days adherence">
              {weekStrip.map((day) => (
                <div key={day.dateKey} className="week-day">
                  <span className="week-day__name">{day.label}</span>
                  <span className="week-day__num tabular-nums">{day.dayNum}</span>
                  <span
                    className={`week-dot week-dot--${day.status}`}
                    title={`${day.dateKey}: ${day.status === 'none' ? 'no activity' : day.status}`}
                    aria-label={`${day.label} ${day.dayNum}: ${day.status}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="alarm-volume" className="field-label">
                  Alarm Volume
                </label>
                <span className="tabular-nums" style={{ fontWeight: 700 }}>
                  {Math.round(settings.defaultVolume * 100)}%
                </span>
              </div>
              <input
                id="alarm-volume"
                type="range"
                min={0.2}
                max={1}
                step={0.1}
                value={settings.defaultVolume}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, defaultVolume: Number(e.target.value) }))
                }
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 6, borderTop: '1px solid var(--color-border-subtle)' }}>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={logs.length === 0}
                  onClick={() => exportHistoryCsv(logs)}
                >
                  <FileSpreadsheet size={16} aria-hidden="true" /> Export CSV
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => exportBackupJson(medications, logs, settings)}
                >
                  <Download size={16} aria-hidden="true" /> Download Backup
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => restoreInputRef.current?.click()}
                >
                  <Upload size={16} aria-hidden="true" /> Restore Backup
                </button>
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept="application/json,.json"
                  style={{ display: 'none' }}
                  onChange={handleRestoreFile}
                />
              </div>
              {restoreStatus && (
                <div style={{ fontSize: '0.85rem', color: 'var(--color-brand-primary)', fontWeight: 600 }}>
                  {restoreStatus}
                </div>
              )}
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="card">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                No activity logged yet. Mark a medication as Taken to see your history.
              </p>
            </div>
          ) : (
            <div className="stack">
              {logs.map((entry) => (
                <article key={entry.id} className="item-card">
                  <div className="item-meta">
                    <div className="item-title-row">
                      <h3 className="item-title">{entry.title}</h3>
                      <span
                        className={`badge ${
                          entry.action === 'taken'
                            ? 'badge--green'
                            : entry.action === 'snoozed'
                              ? 'badge--gold'
                              : 'badge--red'
                        }`}
                      >
                        {entry.action}
                      </span>
                    </div>
                    <div className="item-sub">
                      {entry.subtitle} • Scheduled{' '}
                      <span className="tabular-nums">{formatTime12h(entry.scheduledTime)}</span> •{' '}
                      {new Date(entry.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className="nav-btn"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Modals */}
      <RingingModal
        target={activeRing}
        queueCount={ringQueueCount}
        onMarkTaken={handleRingMarkTaken}
        onSnooze={handleRingSnooze}
        onSkipMed={handleRingSkipMed}
      />

      <MedicationModal
        open={medModalOpen}
        editing={editingMed}
        onClose={() => setMedModalOpen(false)}
        onSave={(saved) => {
          setMedications((prev) => {
            const exists = prev.some((m) => m.id === saved.id);
            return exists ? prev.map((m) => (m.id === saved.id ? saved : m)) : [...prev, saved];
          });
        }}
      />
    </div>
  );
}

export default App;
