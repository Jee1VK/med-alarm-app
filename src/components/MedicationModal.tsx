import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Check, Plus, Trash2, Volume2, X } from 'lucide-react';
import type { AlarmTone, FoodTiming, MedColorTag, Medication, ScheduleMode } from '../types';
import { alarmAudio } from '../utils/alarmAudio';
import { createId } from '../utils/storage';
import { DAY_LABELS } from '../utils/time';

interface MedicationModalProps {
  open: boolean;
  editing: Medication | null;
  onClose: () => void;
  onSave: (med: Medication) => void;
}

const FREQUENCY_PRESETS: { label: string; times: string[] }[] = [
  { label: '1× Morning', times: ['08:00'] },
  { label: '2× Day & Night', times: ['08:00', '20:00'] },
  { label: '3× Meals', times: ['08:00', '13:00', '20:00'] },
  { label: 'Bedtime', times: ['22:00'] },
];

const COLOR_TAGS: { id: MedColorTag; label: string; hex: string }[] = [
  { id: 'sky', label: 'Sky Blue', hex: '#0284C7' },
  { id: 'emerald', label: 'Emerald Green', hex: '#059669' },
  { id: 'amber', label: 'Amber Gold', hex: '#D97706' },
  { id: 'rose', label: 'Rose Pink', hex: '#E11D48' },
  { id: 'indigo', label: 'Indigo', hex: '#4F46E5' },
];

export function MedicationModal({ open, editing, onClose, onSave }: MedicationModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('1 tablet');
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('fixed');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [intervalHours, setIntervalHours] = useState(8);
  const [intervalStart, setIntervalStart] = useState('08:00');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [daysError, setDaysError] = useState(false);
  const [foodTiming, setFoodTiming] = useState<FoodTiming>('after_food');
  const [colorTag, setColorTag] = useState<MedColorTag>('sky');
  const [expiryDate, setExpiryDate] = useState('');
  const [tone, setTone] = useState<AlarmTone>('temple_chime');
  const [vibrate, setVibrate] = useState(true);
  const [notes, setNotes] = useState('');
  const [trackStock, setTrackStock] = useState(true);
  const [remainingDoses, setRemainingDoses] = useState(30);
  const [dosesPerIntake, setDosesPerIntake] = useState(1);
  const [refillThreshold, setRefillThreshold] = useState(5);

  useEffect(() => {
    setDaysError(false);
    if (editing) {
      setName(editing.name);
      setDosage(editing.dosage);
      setScheduleMode(editing.scheduleMode ?? 'fixed');
      setTimes(editing.times.length > 0 ? editing.times : ['08:00']);
      setIntervalHours(editing.intervalHours ?? 8);
      setIntervalStart(editing.intervalStart ?? '08:00');
      setDays(editing.days);
      setFoodTiming(editing.foodTiming);
      setColorTag(editing.colorTag ?? 'sky');
      setExpiryDate(editing.expiryDate ?? '');
      setTone(editing.tone);
      setVibrate(editing.vibrate ?? true);
      setNotes(editing.notes ?? '');
      setTrackStock(editing.trackStock);
      setRemainingDoses(editing.remainingDoses);
      setDosesPerIntake(editing.dosesPerIntake);
      setRefillThreshold(editing.refillThreshold);
    } else {
      setName('');
      setDosage('1 tablet');
      setScheduleMode('fixed');
      setTimes(['08:00']);
      setIntervalHours(8);
      setIntervalStart('08:00');
      setDays([0, 1, 2, 3, 4, 5, 6]);
      setFoodTiming('after_food');
      setColorTag('sky');
      setExpiryDate('');
      setTone('temple_chime');
      setVibrate(true);
      setNotes('');
      setTrackStock(true);
      setRemainingDoses(30);
      setDosesPerIntake(1);
      setRefillThreshold(5);
    }
  }, [editing, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const toggleDay = (day: number) => {
    setDaysError(false);
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (scheduleMode !== 'prn' && days.length === 0) {
      setDaysError(true);
      return;
    }

    const cleanedTimes = Array.from(new Set(times.filter(Boolean))).sort();
    const safeRemaining = Math.max(0, remainingDoses);
    const safeTotal = editing
      ? Math.max(editing.totalDoses, safeRemaining, 1)
      : Math.max(safeRemaining, 1);

    onSave({
      id: editing?.id ?? createId('med'),
      name: name.trim(),
      dosage: dosage.trim(),
      scheduleMode,
      times: cleanedTimes.length > 0 ? cleanedTimes : ['08:00'],
      intervalHours: scheduleMode === 'interval' ? intervalHours : undefined,
      intervalStart: scheduleMode === 'interval' ? intervalStart : undefined,
      days: scheduleMode === 'prn' ? [0, 1, 2, 3, 4, 5, 6] : days,
      foodTiming,
      colorTag,
      expiryDate: expiryDate || undefined,
      notes: notes.trim() || undefined,
      tone,
      vibrate,
      enabled: editing?.enabled ?? true,
      trackStock,
      remainingDoses: safeRemaining,
      totalDoses: safeTotal,
      dosesPerIntake: Math.max(1, dosesPerIntake),
      refillThreshold: Math.max(0, refillThreshold),
    });
    onClose();
  };

  return (
    <dialog ref={dialogRef} aria-labelledby="med-modal-title" onClose={onClose}>
      <div className="dialog-header">
        <h2 id="med-modal-title" className="dialog-title">
          {editing ? 'Edit Medicine & Alarm' : 'Add Medicine & Alarm'}
        </h2>
        <button type="button" className="icon-btn" aria-label="Close dialog" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="dialog-body">
          <div className="grid-2">
            <div className="field">
              <label className="field-label" htmlFor="med-name">
                Medicine Name *
              </label>
              <input
                id="med-name"
                className="input"
                type="text"
                required
                placeholder="e.g., Vitamin D3"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <span className="field-error">Error: Enter a medicine name.</span>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="med-dosage">
                Dosage *
              </label>
              <input
                id="med-dosage"
                className="input"
                type="text"
                required
                placeholder="e.g., 1 tablet"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
              />
              <span className="field-error">Error: Enter dosage details.</span>
            </div>
          </div>

          <div className="field">
            <span className="field-label">Color Tag</span>
            <div className="color-swatch-row" role="group" aria-label="Medicine color tag">
              {COLOR_TAGS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="color-swatch"
                  style={{ background: c.hex }}
                  aria-label={c.label}
                  aria-pressed={colorTag === c.id}
                  onClick={() => setColorTag(c.id)}
                >
                  {colorTag === c.id && <Check size={18} aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="med-schedule-mode">
              Alarm Type
            </label>
            <select
              id="med-schedule-mode"
              className="select"
              value={scheduleMode}
              onChange={(e) => setScheduleMode(e.target.value as ScheduleMode)}
            >
              <option value="fixed">Fixed Times Daily (e.g., 8:00 AM, 8:00 PM)</option>
              <option value="interval">Every X Hours (e.g., Every 6 or 8 hours)</option>
              <option value="prn">As Needed / PRN (No alarm, log manually)</option>
            </select>
          </div>

          {scheduleMode === 'fixed' && (
            <>
              <div className="field">
                <span className="field-label">Quick Schedule Presets</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {FREQUENCY_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setTimes(preset.times)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="field-label">Linked Alarm Times</span>
                <div className="stack">
                  {times.map((t, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        className="input tabular-nums"
                        type="time"
                        required
                        aria-label={`Alarm time ${idx + 1}`}
                        value={t}
                        onChange={(e) => {
                          const next = [...times];
                          next[idx] = e.target.value;
                          setTimes(next);
                        }}
                        style={{ flex: 1 }}
                      />
                      {times.length > 1 && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Remove alarm time ${idx + 1}`}
                          onClick={() => setTimes(times.filter((_, i) => i !== idx))}
                        >
                          <Trash2 size={18} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setTimes([...times, '20:00'])}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    <Plus size={16} aria-hidden="true" /> Add Another Time
                  </button>
                </div>
              </div>
            </>
          )}

          {scheduleMode === 'interval' && (
            <div className="grid-2">
              <div className="field">
                <label className="field-label" htmlFor="med-interval-hours">
                  Repeat Every
                </label>
                <select
                  id="med-interval-hours"
                  className="select"
                  value={intervalHours}
                  onChange={(e) => setIntervalHours(Number(e.target.value))}
                >
                  <option value={4}>Every 4 hours</option>
                  <option value={6}>Every 6 hours</option>
                  <option value={8}>Every 8 hours</option>
                  <option value={12}>Every 12 hours</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="med-interval-start">
                  First Dose At
                </label>
                <input
                  id="med-interval-start"
                  className="input tabular-nums"
                  type="time"
                  required
                  value={intervalStart}
                  onChange={(e) => setIntervalStart(e.target.value)}
                />
              </div>
            </div>
          )}

          {scheduleMode !== 'prn' && (
            <div className="field">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <span className="field-label">Alarm Repeat Days</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => {
                      setDaysError(false);
                      setDays([0, 1, 2, 3, 4, 5, 6]);
                    }}
                  >
                    Every day
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => {
                      setDaysError(false);
                      setDays([1, 2, 3, 4, 5]);
                    }}
                  >
                    Weekdays
                  </button>
                </div>
              </div>
              <div className="days-grid" role="group" aria-label="Repeat days">
                {DAY_LABELS.map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    className="day-chip"
                    aria-pressed={days.includes(idx)}
                    onClick={() => toggleDay(idx)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {daysError && (
                <span style={{ fontSize: '0.82rem', color: 'var(--color-feedback-error)', fontWeight: 600 }}>
                  Error: Select at least one repeat day.
                </span>
              )}
            </div>
          )}

          <div className="grid-2">
            <div className="field">
              <label className="field-label" htmlFor="med-food">
                Food Timing
              </label>
              <select
                id="med-food"
                className="select"
                value={foodTiming}
                onChange={(e) => setFoodTiming(e.target.value as FoodTiming)}
              >
                <option value="before_food">Before Food</option>
                <option value="after_food">After Food</option>
                <option value="with_food">With Food</option>
                <option value="anytime">Anytime</option>
              </select>
            </div>

            {scheduleMode !== 'prn' && (
              <div className="field">
                <label className="field-label" htmlFor="med-tone">
                  Alarm Sound
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    id="med-tone"
                    className="select"
                    style={{ flex: 1 }}
                    value={tone}
                    onChange={(e) => setTone(e.target.value as AlarmTone)}
                  >
                    <option value="temple_chime">Temple Chime</option>
                    <option value="classic_bell">Classic Bell</option>
                    <option value="urgent_pulse">Urgent Pulse</option>
                    <option value="gentle_dawn">Gentle Dawn</option>
                  </select>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Preview alarm sound"
                    onClick={() => void alarmAudio.preview(tone, 0.85)}
                  >
                    <Volume2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {scheduleMode !== 'prn' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minHeight: 44 }}>
              <input
                type="checkbox"
                checked={vibrate}
                onChange={(e) => setVibrate(e.target.checked)}
                style={{ width: 20, height: 20 }}
              />
              <span className="field-label">Vibrate when alarm rings</span>
            </label>
          )}

          <details>
            <summary
              style={{
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: 'var(--color-brand-primary)',
                padding: '6px 0',
              }}
            >
              More Options (Pill Stock, Expiry Date &amp; Notes)
            </summary>
            <div className="stack" style={{ marginTop: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minHeight: 44 }}>
                <input
                  type="checkbox"
                  checked={trackStock}
                  onChange={(e) => setTrackStock(e.target.checked)}
                  style={{ width: 20, height: 20 }}
                />
                <span className="field-label">Track Pill Stock &amp; Refill Alerts</span>
              </label>

              {trackStock && (
                <div className="grid-2">
                  <div className="field">
                    <label className="field-label" htmlFor="med-remaining">
                      Remaining Doses
                    </label>
                    <input
                      id="med-remaining"
                      className="input tabular-nums"
                      type="number"
                      min={0}
                      value={remainingDoses}
                      onChange={(e) => setRemainingDoses(Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="med-threshold">
                      Refill Alert At
                    </label>
                    <input
                      id="med-threshold"
                      className="input tabular-nums"
                      type="number"
                      min={0}
                      value={refillThreshold}
                      onChange={(e) => setRefillThreshold(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}

              <div className="field">
                <label className="field-label" htmlFor="med-expiry">
                  Expiry Date (Optional)
                </label>
                <input
                  id="med-expiry"
                  className="input tabular-nums"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="med-notes">
                  Notes (Optional)
                </label>
                <textarea
                  id="med-notes"
                  className="textarea"
                  placeholder="e.g., Take with warm water"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </details>
        </div>

        <div className="dialog-footer">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            {editing ? 'Save Changes' : 'Save Medicine'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
