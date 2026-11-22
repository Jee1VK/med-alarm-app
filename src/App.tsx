import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  AlertTriangle,
  Bell,
  BellRing,
  CalendarClock,
  Check,
  History,
  Moon,
  Pencil,
  Pill,
  Plus,
  RefreshCw,
  Sun,
  Trash2,
  Volume2,
} from 'lucide-react';
import { AlarmModal } from './components/AlarmModal';
import { MedicationModal } from './components/MedicationModal';
import { RingingModal } from './components/RingingModal';
import { useAlarmScheduler } from './hooks/useAlarmScheduler';
import type { AppSettings, GeneralAlarm, LogEntry, Medication, RingingTarget } from './types';
import { alarmAudio } from './utils/alarmAudio';
import {
  createId,
  loadInitialData,
  saveAlarms,
  saveLogs,
  saveMedications,
  saveSettings,
} from './utils/storage';
import {
  foodTimingLabel,
  formatCountdown,
  formatDaysSummary,
  formatTime12h,
  minutesUntil,
  toDateKey,
} from './utils/time';

type Tab = 'today' | 'medications' | 'alarms' | 'history';

export function App() {
  const initial = useMemo(() => loadInitialData(), []);

  const [tab, setTab] = useState<Tab>('today');
  const [medications, setMedications] = useState<Medication[]>(initial.medications);
  const [alarms, setAlarms] = useState<GeneralAlarm[]>(initial.alarms);
  const [logs, setLogs] = useState<LogEntry[]>(initial.logs);
  const [settings, setSettings] = useState<AppSettings>(initial.settings);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('medclock.theme.v1');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [confirmClearLog, setConfirmClearLog] = useState(false);

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  // Modals
  const [medModalOpen, setMedModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [alarmModalOpen, setAlarmModalOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<GeneralAlarm | null>(null);

  // Persist changes
  useEffect(() => saveMedications(medications), [medications]);
  useEffect(() => saveAlarms(alarms), [alarms]);
  useEffect(() => saveLogs(logs), [logs]);
  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('medclock.theme.v1', theme);
  }, [theme]);

  const handleOneTimeAlarmFired = useCallback((alarmId: string) => {
    setAlarms((prev) => prev.map((a) => (a.id === alarmId ? { ...a, enabled: false } : a)));
  }, []);

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
    alarms,
    logs,
    settings,
    onOneTimeAlarmFired: handleOneTimeAlarmFired,
  });

  const todayKey = toDateKey(now);
  const todayDow = now.getDay();

  // Enable audio on first user interaction anywhere in the app
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
    alarmAudio.preview('temple_chime', settings.defaultVolume);
  };

  const handleRequestNotifications = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  const logAction = (
    kind: 'medication' | 'alarm',
    itemId: string,
    title: string,
    subtitle: string,
    scheduledTime: string,
    action: LogEntry['action']
  ) => {
    const entry: LogEntry = {
      id: createId('log'),
      kind,
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

  const markMedicationTaken = (med: Medication, scheduledTime: string) => {
    logAction('medication', med.id, med.name, med.dosage, scheduledTime, 'taken');
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

  const handleRingTakeOrDismiss = (target: RingingTarget) => {
    if (target.kind === 'medication') {
      const med = medications.find((m) => m.id === target.itemId);
      if (med) {
        markMedicationTaken(med, target.scheduledTime);
      }
    } else {
      logAction('alarm', target.itemId, target.title, 'Alarm', target.scheduledTime, 'dismissed');
    }
    dismissCurrentRing();
  };

  const handleRingSkipMed = (target: RingingTarget) => {
    logAction('medication', target.itemId, target.title, target.subtitle, target.scheduledTime, 'skipped');
    dismissCurrentRing();
  };

  const handleRingSnooze = (minutes: number) => {
    if (activeRing) {
      logAction(
        activeRing.kind,
        activeRing.itemId,
        activeRing.title,
        `${activeRing.subtitle} (Snoozed ${minutes}m)`,
        activeRing.scheduledTime,
        'snoozed'
      );
    }
    snoozeCurrentRing(minutes);
  };

  // Today's chronological schedule
  const todaySchedule = useMemo(() => {
    type ScheduleRow =
      | {
          kind: 'medication';
          key: string;
          time: string;
          med: Medication;
          status: 'pending' | 'taken' | 'skipped';
        }
      | {
          kind: 'alarm';
          key: string;
          time: string;
          alarm: GeneralAlarm;
        };

    const rows: ScheduleRow[] = [];

    for (const med of medications) {
      if (!med.enabled || !med.days.includes(todayDow)) continue;
      for (const t of med.times) {
        const log = logs.find(
          (l) =>
            l.kind === 'medication' &&
            l.itemId === med.id &&
            l.dateKey === todayKey &&
            l.scheduledTime === t &&
            (l.action === 'taken' || l.action === 'skipped')
        );
        rows.push({
          kind: 'medication',
          key: `med-${med.id}-${t}`,
          time: t,
          med,
          status: log ? (log.action === 'taken' ? 'taken' : 'skipped') : 'pending',
        });
      }
    }

    for (const alarm of alarms) {
      if (!alarm.enabled) continue;
      if (alarm.days.length > 0 && !alarm.days.includes(todayDow)) continue;
      rows.push({
        kind: 'alarm',
        key: `alarm-${alarm.id}-${alarm.time}`,
        time: alarm.time,
        alarm,
      });
    }

    return rows.sort((a, b) => a.time.localeCompare(b.time));
  }, [medications, alarms, logs, todayDow, todayKey]);

  const nextUpcoming = useMemo(() => {
    const candidates: { title: string; time: string; mins: number }[] = [];
    for (const row of todaySchedule) {
      if (row.kind === 'medication' && row.status !== 'pending') continue;
      const mins = minutesUntil(row.time, now);
      candidates.push({
        title: row.kind === 'medication' ? row.med.name : row.alarm.label,
        time: row.time,
        mins,
      });
    }
    candidates.sort((a, b) => a.mins - b.mins);
    return candidates[0] ?? null;
  }, [todaySchedule, now]);

  const lowStockMeds = useMemo(
    () => medications.filter((m) => m.trackStock && m.remainingDoses <= m.refillThreshold),
    [medications]
  );

  const adherenceStats = useMemo(() => {
    const medLogs = logs.filter((l) => l.kind === 'medication' && (l.action === 'taken' || l.action === 'skipped'));
    const taken = medLogs.filter((l) => l.action === 'taken').length;
    const skipped = medLogs.filter((l) => l.action === 'skipped').length;
    const total = taken + skipped;
    const pct = total === 0 ? 100 : Math.round((taken / total) * 100);
    return { taken, skipped, total, pct };
  }, [logs]);

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
    { id: 'medications', label: 'Meds', icon: Pill },
    { id: 'alarms', label: 'Alarms', icon: AlarmClock },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <AlarmClock size={22} />
          </div>
          <div>
            <h1 className="brand-title">MedClock</h1>
            <p className="brand-subtitle">Medication Reminders &amp; Alarm Clock</p>
          </div>
        </div>

        <div className="header-actions">
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
            onClick={() =>
              triggerTestRing({
                key: `test-${Date.now()}`,
                kind: 'medication',
                itemId: 'test',
                title: 'Test Medication Alarm',
                subtitle: '1 tablet • Sound & Snooze Check',
                scheduledTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
                tone: 'temple_chime',
                vibrate: true,
                foodTiming: 'after_food',
              })
            }
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
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* TODAY TAB */}
      {tab === 'today' && (
        <main>
          <section className="hero-clock-card" aria-label="Live clock and next reminder">
            <div>
              <div className="hero-time tabular-nums">{formattedClock}</div>
              <div className="hero-date">{formattedDate}</div>
            </div>
            <div className="hero-next-pill">
              <div className="hero-next-label">Next Up</div>
              {nextUpcoming ? (
                <div className="hero-next-value">
                  {nextUpcoming.title} •{' '}
                  <span className="tabular-nums">{formatTime12h(nextUpcoming.time)}</span> (
                  {formatCountdown(nextUpcoming.mins)})
                </div>
              ) : (
                <div className="hero-next-value">All caught up for today</div>
              )}
            </div>
          </section>

          {(() => {
            const todayMeds = todaySchedule.filter((r) => r.kind === 'medication');
            const takenCount = todayMeds.filter((r) => r.status === 'taken').length;
            if (todayMeds.length === 0) return null;
            const pct = Math.round((takenCount / todayMeds.length) * 100);
            return (
              <section className="progress-card" aria-label="Today's medication progress">
                <div className="progress-header">
                  <span>Today&apos;s Medication Progress</span>
                  <span className="tabular-nums" style={{ color: 'var(--color-brand-secondary)' }}>
                    {takenCount} / {todayMeds.length} taken ({pct}%)
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </section>
            );
          })()}

          {!audioUnlocked && (
            <div className="banner banner--warning" role="status">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Volume2 size={18} />
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
                <Bell size={18} />
                <span>Allow browser notifications for background alerts.</span>
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
                {snoozed.map((s) => {
                  const minsLeft = Math.max(1, Math.ceil((s.wakeAtMs - now.getTime()) / 60000));
                  return `${s.scheduledTime} (${minsLeft}m left)`;
                }).join(', ')}
              </div>
            </div>
          )}

          {lowStockMeds.length > 0 && (
            <div className="banner banner--warning" role="alert">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={18} />
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

          <div className="section-header">
            <h2 className="section-title">Today&apos;s Schedule</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => {
                  setEditingMed(null);
                  setMedModalOpen(true);
                }}
              >
                <Plus size={16} /> Med
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  setEditingAlarm(null);
                  setAlarmModalOpen(true);
                }}
              >
                <Plus size={16} /> Alarm
              </button>
            </div>
          </div>

          {todaySchedule.length === 0 ? (
            <div className="card">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                No medications or alarms scheduled for today. Add one above to get started.
              </p>
            </div>
          ) : (
            <div className="stack">
              {todaySchedule.map((row) => {
                if (row.kind === 'medication') {
                  const { med, status, time } = row;
                  return (
                    <article
                      key={row.key}
                      className={`item-card ${status !== 'pending' ? 'item-card--done' : ''}`}
                    >
                      <div className="item-meta">
                        <div className="item-title-row">
                          <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--color-brand-primary)' }}>
                            {formatTime12h(time)}
                          </span>
                          <h3 className="item-title">{med.name}</h3>
                          <span className="badge badge--gold">{foodTimingLabel(med.foodTiming)}</span>
                          {status === 'taken' && <span className="badge badge--green">Taken</span>}
                          {status === 'skipped' && <span className="badge badge--red">Skipped</span>}
                        </div>
                        <div className="item-sub">{med.dosage}</div>
                      </div>

                      {status === 'pending' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn--success btn--sm"
                            onClick={() => markMedicationTaken(med, time)}
                          >
                            <Check size={16} /> Take
                          </button>
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() =>
                              logAction('medication', med.id, med.name, med.dosage, time, 'skipped')
                            }
                          >
                            Skip
                          </button>
                        </div>
                      )}
                    </article>
                  );
                }

                const { alarm } = row;
                return (
                  <article key={row.key} className="item-card item-card--alarm">
                    <div className="item-meta">
                      <div className="item-title-row">
                        <span className="tabular-nums" style={{ fontWeight: 700, color: 'var(--color-alarm-indigo)' }}>
                          {formatTime12h(alarm.time)}
                        </span>
                        <h3 className="item-title">{alarm.label}</h3>
                        <span className="badge badge--blue">Alarm</span>
                      </div>
                      <div className="item-sub">{formatDaysSummary(alarm.days)}</div>
                    </div>
                    <label className="switch-wrap" aria-label={`Toggle ${alarm.label}`}>
                      <input
                        className="switch-input"
                        type="checkbox"
                        checked={alarm.enabled}
                        onChange={() =>
                          setAlarms((prev) =>
                            prev.map((a) => (a.id === alarm.id ? { ...a, enabled: !a.enabled } : a))
                          )
                        }
                      />
                    </label>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* MEDICATIONS TAB */}
      {tab === 'medications' && (
        <main>
          <div className="section-header">
            <h2 className="section-title">Medications</h2>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => {
                setEditingMed(null);
                setMedModalOpen(true);
              }}
            >
              <Plus size={16} /> Add Medication
            </button>
          </div>

          {medications.length === 0 ? (
            <div className="card">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                No medications added yet.
              </p>
            </div>
          ) : (
            <div className="stack">
              {medications.map((med) => {
                const isLow = med.trackStock && med.remainingDoses <= med.refillThreshold;
                const stockPct = med.totalDoses > 0 ? Math.min(100, (med.remainingDoses / med.totalDoses) * 100) : 0;
                return (
                  <article key={med.id} className={`item-card ${!med.enabled ? 'item-card--dim' : ''}`}>
                    <div className="item-meta">
                      <div className="item-title-row">
                        <h3 className="item-title">{med.name}</h3>
                        <span className="badge badge--gold">{foodTimingLabel(med.foodTiming)}</span>
                        {isLow && <span className="badge badge--red">Refill Low</span>}
                      </div>
                      <div className="item-sub">
                        {med.dosage} •{' '}
                        <span className="tabular-nums">
                          {med.times.map((t) => formatTime12h(t)).join(', ')}
                        </span>{' '}
                        • {formatDaysSummary(med.days)}
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                          <RefreshCw size={14} /> +30
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
                        <Pencil size={17} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Delete ${med.name}`}
                        onClick={() => setMedications((prev) => prev.filter((m) => m.id !== med.id))}
                      >
                        <Trash2 size={17} />
                      </button>
                      <label className="switch-wrap" aria-label={`Enable ${med.name}`}>
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

      {/* ALARMS TAB */}
      {tab === 'alarms' && (
        <main>
          <div className="section-header">
            <h2 className="section-title">Alarm Clock</h2>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => {
                setEditingAlarm(null);
                setAlarmModalOpen(true);
              }}
            >
              <Plus size={16} /> New Alarm
            </button>
          </div>

          {alarms.length === 0 ? (
            <div className="card">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                No alarms configured. Create a wake-up or custom alarm above.
              </p>
            </div>
          ) : (
            <div className="stack">
              {alarms.map((alarm) => (
                <article key={alarm.id} className={`item-card ${!alarm.enabled ? 'item-card--dim' : ''}`}>
                  <div className="item-meta">
                    <div className="item-title-row">
                      <span
                        className="tabular-nums"
                        style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-brand-primary)' }}
                      >
                        {formatTime12h(alarm.time)}
                      </span>
                      <h3 className="item-title">{alarm.label}</h3>
                    </div>
                    <div className="item-sub">{formatDaysSummary(alarm.days)}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Edit ${alarm.label}`}
                      onClick={() => {
                        setEditingAlarm(alarm);
                        setAlarmModalOpen(true);
                      }}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Delete ${alarm.label}`}
                      onClick={() => setAlarms((prev) => prev.filter((a) => a.id !== alarm.id))}
                    >
                      <Trash2 size={17} />
                    </button>
                    <label className="switch-wrap" aria-label={`Enable ${alarm.label}`}>
                      <input
                        className="switch-input"
                        type="checkbox"
                        checked={alarm.enabled}
                        onChange={() =>
                          setAlarms((prev) =>
                            prev.map((a) => (a.id === alarm.id ? { ...a, enabled: !a.enabled } : a))
                          )
                        }
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <main>
          <div className="section-header">
            <h2 className="section-title">Adherence &amp; History</h2>
            {logs.length > 0 && (
              confirmClearLog ? (
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
              )
            )}
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            </div>
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
          </div>

          {logs.length === 0 ? (
            <div className="card">
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                No activity logged yet. Mark a medication as Taken or dismiss an alarm to see history.
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
                          entry.action === 'taken' || entry.action === 'dismissed'
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
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Modals */}
      <RingingModal
        target={activeRing}
        queueCount={ringQueueCount}
        onTakeOrDismiss={handleRingTakeOrDismiss}
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

      <AlarmModal
        open={alarmModalOpen}
        editing={editingAlarm}
        onClose={() => setAlarmModalOpen(false)}
        onSave={(saved) => {
          setAlarms((prev) => {
            const exists = prev.some((a) => a.id === saved.id);
            return exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [...prev, saved];
          });
        }}
      />
    </div>
  );
}

export default App;
