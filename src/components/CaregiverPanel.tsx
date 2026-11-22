import { useState } from 'react';
import {
  BellRing,
  Check,
  Copy,
  Flame,
  RefreshCw,
  Share2,
  Shield,
  Unlink,
  Users,
} from 'lucide-react';
import type {
  CaregiverShareConfig,
  CaregiverSnapshot,
  CaregiverWatchConfig,
  LogEntry,
  Medication,
} from '../types';
import {
  buildCaregiverSnapshot,
  fetchCaregiverSnapshot,
  generateCaregiverCode,
  hashPin,
  pushCaregiverSnapshot,
} from '../utils/caregiverSync';
import { formatTime, getMedicationTimes, signedMinutesUntil, toDateKey } from '../utils/time';

interface CaregiverPanelProps {
  medications: Medication[];
  logs: LogEntry[];
  now: Date;
  use24Hour: boolean;
  shareConfig: CaregiverShareConfig;
  onUpdateShareConfig: (cfg: CaregiverShareConfig) => void;
  watchConfig: CaregiverWatchConfig | null;
  onUpdateWatchConfig: (cfg: CaregiverWatchConfig | null) => void;
  watchedSnapshot: CaregiverSnapshot | null;
  onUpdateWatchedSnapshot: (snap: CaregiverSnapshot | null) => void;
}

export function CaregiverPanel({
  medications,
  logs,
  now,
  use24Hour,
  shareConfig,
  onUpdateShareConfig,
  watchConfig,
  onUpdateWatchConfig,
  watchedSnapshot,
  onUpdateWatchedSnapshot,
}: CaregiverPanelProps) {
  const [pinInput, setPinInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const [connectCode, setConnectCode] = useState(watchConfig?.code ?? '');
  const [connectPin, setConnectPin] = useState('');
  const [connectUrl, setConnectUrl] = useState(
    watchConfig?.syncServerUrl ||
      shareConfig.syncServerUrl ||
      'https://medclock-caregiver-sync.medclock-sync.workers.dev'
  );
  const [watchStatus, setWatchStatus] = useState<string | null>(null);
  const [loadingWatch, setLoadingWatch] = useState(false);

  const todayKey = toDateKey(now);
  const todayDow = now.getDay();

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(shareConfig.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareStatus(`Caregiver Code: ${shareConfig.code}`);
    }
  };

  const handleShareSummary = async () => {
    const snap = buildCaregiverSnapshot(shareConfig, medications, logs, now);
    const todayMeds = medications.filter(
      (m) => m.enabled && m.scheduleMode !== 'prn' && m.days.includes(todayDow)
    );
    let total = 0;
    let taken = 0;
    for (const m of todayMeds) {
      for (const t of getMedicationTimes(m)) {
        total += 1;
        const done = logs.some(
          (l) => l.itemId === m.id && l.dateKey === todayKey && l.scheduledTime === t && l.action === 'taken'
        );
        if (done) taken += 1;
      }
    }
    const text = `MedClock Update (${snap.patientLabel}): ${taken}/${total} doses taken today • ${snap.streak}-day streak • Adherence ${snap.adherencePct}%.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'MedClock Progress', text });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareStatus('Daily progress summary copied — paste in WhatsApp or SMS!');
    } catch {
      setShareStatus(text);
    }
  };

  const handleSyncNow = async () => {
    if (!shareConfig.syncServerUrl.trim()) {
      setShareStatus('Add a Sync Server URL below to push live updates to another phone.');
      return;
    }
    setShareStatus('Syncing…');
    const snap = buildCaregiverSnapshot(shareConfig, medications, logs, now);
    const res = await pushCaregiverSnapshot(shareConfig, snap);
    if (res.ok) {
      onUpdateShareConfig({ ...shareConfig, lastSyncedAt: new Date().toISOString() });
      setShareStatus('Synced live to cloud relay.');
    } else {
      setShareStatus(`Sync failed: ${res.error}`);
    }
  };

  const handleConnect = async () => {
    const cleanCode = connectCode.trim().toUpperCase();
    if (cleanCode.length < 4) {
      setWatchStatus('Enter a valid 6-character Caregiver Code.');
      return;
    }
    if (!connectUrl.trim()) {
      setWatchStatus('Enter the Sync Server URL first.');
      return;
    }
    setLoadingWatch(true);
    setWatchStatus(null);
    const pinHash = connectPin.trim() ? await hashPin(connectPin) : watchConfig?.pinHash;
    const nextWatch: CaregiverWatchConfig = {
      code: cleanCode,
      pinHash,
      syncServerUrl: connectUrl.trim(),
      ringOnThisPhone: watchConfig?.ringOnThisPhone ?? false,
      lastFetchedAt: new Date().toISOString(),
    };
    const res = await fetchCaregiverSnapshot(nextWatch);
    setLoadingWatch(false);
    if (res.snapshot) {
      onUpdateWatchConfig(nextWatch);
      onUpdateWatchedSnapshot(res.snapshot);
      setWatchStatus(`Connected to ${res.snapshot.patientLabel}.`);
    } else {
      setWatchStatus(res.pinRequired ? 'PIN required or incorrect.' : (res.error ?? 'Could not connect.'));
    }
  };

  const handleRefreshWatch = async () => {
    if (!watchConfig) return;
    setLoadingWatch(true);
    const res = await fetchCaregiverSnapshot(watchConfig);
    setLoadingWatch(false);
    if (res.snapshot) {
      onUpdateWatchedSnapshot(res.snapshot);
      onUpdateWatchConfig({ ...watchConfig, lastFetchedAt: new Date().toISOString() });
      setWatchStatus('Updated just now.');
    } else {
      setWatchStatus(res.error ?? 'Could not refresh.');
    }
  };

  // Compute watched person's today schedule
  const watchedTodayRows = (() => {
    if (!watchedSnapshot) return [];
    const rows: { key: string; time: string; med: Medication; status: 'pending' | 'taken' | 'skipped' }[] = [];
    for (const med of watchedSnapshot.medications) {
      if (!med.enabled || med.scheduleMode === 'prn' || !med.days.includes(todayDow)) continue;
      for (const t of getMedicationTimes(med)) {
        const log = watchedSnapshot.recentLogs.find(
          (l) =>
            l.itemId === med.id &&
            l.dateKey === todayKey &&
            l.scheduledTime === t &&
            (l.action === 'taken' || l.action === 'skipped')
        );
        rows.push({
          key: `${med.id}:${t}`,
          time: t,
          med,
          status: log ? (log.action === 'taken' ? 'taken' : 'skipped') : 'pending',
        });
      }
    }
    return rows.sort((a, b) => a.time.localeCompare(b.time));
  })();

  return (
    <main>
      <div className="section-header">
        <h2 className="section-title">Caregiver &amp; Family Sync</h2>
      </div>

      {/* SECTION 1: TRACK ANOTHER PERSON */}
      <section className="card" style={{ marginBottom: 14 }} aria-label="Track another person">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} aria-hidden="true" />
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Track Another Person</h3>
          </div>
          {watchConfig && (
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                onUpdateWatchConfig(null);
                onUpdateWatchedSnapshot(null);
                setWatchStatus('Disconnected.');
              }}
            >
              <Unlink size={14} aria-hidden="true" /> Disconnect
            </button>
          )}
        </div>

        {!watchConfig || !watchedSnapshot ? (
          <div className="stack">
            <div className="grid-2">
              <div className="field">
                <label className="field-label" htmlFor="cg-watch-code">
                  Caregiver Code
                </label>
                <input
                  id="cg-watch-code"
                  className="input tabular-nums"
                  type="text"
                  placeholder="e.g., K7M9P2"
                  value={connectCode}
                  onChange={(e) => setConnectCode(e.target.value.toUpperCase())}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="cg-watch-pin">
                  PIN (If Set)
                </label>
                <input
                  id="cg-watch-pin"
                  className="input tabular-nums"
                  type="password"
                  inputMode="numeric"
                  placeholder="Optional 4-digit PIN"
                  value={connectPin}
                  onChange={(e) => setConnectPin(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="cg-watch-url">
                Sync Relay URL (Cloudflare Worker)
              </label>
              <input
                id="cg-watch-url"
                className="input"
                type="url"
                placeholder="https://medclock-caregiver-sync.your-subdomain.workers.dev"
                value={connectUrl}
                onChange={(e) => setConnectUrl(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="btn btn--primary"
              disabled={loadingWatch}
              onClick={() => void handleConnect()}
            >
              {loadingWatch ? 'Connecting…' : 'Connect & View Progress'}
            </button>
          </div>
        ) : (
          <div className="stack">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{watchedSnapshot.patientLabel}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                  Last updated {new Date(watchedSnapshot.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !use24Hour })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="streak-pill">
                  <Flame size={14} aria-hidden="true" />
                  <span className="tabular-nums">{watchedSnapshot.streak}</span>-day streak
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Refresh tracked progress"
                  disabled={loadingWatch}
                  onClick={() => void handleRefreshWatch()}
                >
                  <RefreshCw size={17} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Ring Alarms on Caregiver Phone Toggle */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 'var(--radius-badge)',
                background: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border-subtle)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <BellRing size={18} aria-hidden="true" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Ring Alarms on This Phone</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    Also ring {watchedSnapshot.patientLabel}&apos;s scheduled alarms here
                  </div>
                </div>
              </div>
              <input
                className="switch-input"
                type="checkbox"
                checked={watchConfig.ringOnThisPhone}
                onChange={(e) =>
                  onUpdateWatchConfig({ ...watchConfig, ringOnThisPhone: e.target.checked })
                }
              />
            </label>

            {watchedTodayRows.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                No scheduled doses for today.
              </p>
            ) : (
              <div className="stack">
                {watchedTodayRows.map(({ key, time, med, status }) => {
                  const isOverdue = status === 'pending' && signedMinutesUntil(time, now) < 0;
                  return (
                    <div key={key} className="item-card" style={{ padding: '10px 12px' }}>
                      <div className="item-meta">
                        <div className="item-title-row">
                          <span className="tabular-nums" style={{ fontWeight: 700 }}>
                            {formatTime(time, use24Hour)}
                          </span>
                          <span style={{ fontWeight: 700 }}>{med.name}</span>
                          {isOverdue && <span className="badge badge--red">Overdue</span>}
                          {status === 'taken' && <span className="badge badge--green">Taken</span>}
                          {status === 'skipped' && <span className="badge badge--red">Skipped</span>}
                          {status === 'pending' && !isOverdue && <span className="badge">Upcoming</span>}
                        </div>
                        <div className="item-sub">{med.dosage}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {watchStatus && (
          <p style={{ margin: '10px 0 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-brand-primary)' }}>
            {watchStatus}
          </p>
        )}
      </section>

      {/* SECTION 2: SHARE MY PROGRESS */}
      <section className="card" aria-label="Share my progress">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} aria-hidden="true" />
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Share My Progress</h3>
          </div>
          <label className="switch-wrap" aria-label="Enable Caregiver Sharing">
            <input
              className="switch-input"
              type="checkbox"
              checked={shareConfig.enabled}
              onChange={(e) => onUpdateShareConfig({ ...shareConfig, enabled: e.target.checked })}
            />
          </label>
        </div>

        <div className="stack">
          <div className="grid-2">
            <div className="field">
              <label className="field-label" htmlFor="cg-patient-label">
                Your Name / Label
              </label>
              <input
                id="cg-patient-label"
                className="input"
                type="text"
                placeholder="e.g., Dad"
                value={shareConfig.patientLabel}
                onChange={(e) => onUpdateShareConfig({ ...shareConfig, patientLabel: e.target.value })}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="cg-share-pin">
                Optional 4-Digit PIN
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  id="cg-share-pin"
                  className="input tabular-nums"
                  type="password"
                  inputMode="numeric"
                  style={{ flex: 1 }}
                  placeholder={shareConfig.pinHash ? 'PIN active' : 'No PIN'}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={async () => {
                    const hashed = pinInput.trim() ? await hashPin(pinInput) : undefined;
                    onUpdateShareConfig({ ...shareConfig, pinHash: hashed });
                    setPinInput('');
                    setShareStatus(hashed ? 'PIN updated.' : 'PIN cleared.');
                  }}
                >
                  Set
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 'var(--radius-badge)',
              background: 'var(--color-surface-elevated)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Your Caregiver Code</div>
              <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '0.12em' }}>
                {shareConfig.code}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => void handleCopyCode()}>
                {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() =>
                  onUpdateShareConfig({ ...shareConfig, code: generateCaregiverCode(6) })
                }
              >
                New Code
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => void handleShareSummary()}>
              <Share2 size={16} aria-hidden="true" /> Share Daily Report (WhatsApp / SMS)
            </button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => void handleSyncNow()}>
              <RefreshCw size={16} aria-hidden="true" /> Sync Live Now
            </button>
          </div>

          <details>
            <summary style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-brand-primary)' }}>
              Cloud Sync Server Settings (Free Cloudflare Worker)
            </summary>
            <div className="field" style={{ marginTop: 8 }}>
              <label className="field-label" htmlFor="cg-share-url">
                Sync Relay URL
              </label>
              <input
                id="cg-share-url"
                className="input"
                type="url"
                placeholder="https://medclock-caregiver-sync.your-subdomain.workers.dev"
                value={shareConfig.syncServerUrl}
                onChange={(e) => onUpdateShareConfig({ ...shareConfig, syncServerUrl: e.target.value })}
              />
            </div>
          </details>

          {shareStatus && (
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-brand-primary)' }}>
              {shareStatus}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
