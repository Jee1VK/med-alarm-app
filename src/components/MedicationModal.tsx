import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Volume2, X } from 'lucide-react';
import type { AlarmTone, FoodTiming, Medication } from '../types';
import { alarmAudio } from '../utils/alarmAudio';
import { createId } from '../utils/storage';
import { DAY_LABELS } from '../utils/time';

interface MedicationModalProps {
  open: boolean;
  editing: Medication | null;
  onClose: () => void;
  onSave: (med: Medication) => void;
}

export function MedicationModal({ open, editing, onClose, onSave }: MedicationModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('1 tablet');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [foodTiming, setFoodTiming] = useState<FoodTiming>('after_food');
  const [tone, setTone] = useState<AlarmTone>('temple_chime');
  const [notes, setNotes] = useState('');
  const [trackStock, setTrackStock] = useState(true);
  const [remainingDoses, setRemainingDoses] = useState(30);
  const [totalDoses, setTotalDoses] = useState(30);
  const [dosesPerIntake, setDosesPerIntake] = useState(1);
  const [refillThreshold, setRefillThreshold] = useState(5);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setDosage(editing.dosage);
      setTimes(editing.times.length > 0 ? editing.times : ['08:00']);
      setDays(editing.days);
      setFoodTiming(editing.foodTiming);
      setTone(editing.tone);
      setNotes(editing.notes ?? '');
      setTrackStock(editing.trackStock);
      setRemainingDoses(editing.remainingDoses);
      setTotalDoses(editing.totalDoses);
      setDosesPerIntake(editing.dosesPerIntake);
      setRefillThreshold(editing.refillThreshold);
    } else {
      setName('');
      setDosage('1 tablet');
      setTimes(['08:00']);
      setDays([0, 1, 2, 3, 4, 5, 6]);
      setFoodTiming('after_food');
      setTone('temple_chime');
      setNotes('');
      setTrackStock(true);
      setRemainingDoses(30);
      setTotalDoses(30);
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
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanedTimes = Array.from(new Set(times.filter(Boolean))).sort();
    onSave({
      id: editing?.id ?? createId('med'),
      name: name.trim(),
      dosage: dosage.trim(),
      times: cleanedTimes.length > 0 ? cleanedTimes : ['08:00'],
      days: days.length > 0 ? days : [0, 1, 2, 3, 4, 5, 6],
      foodTiming,
      notes: notes.trim() || undefined,
      tone,
      enabled: editing?.enabled ?? true,
      trackStock,
      remainingDoses: Math.max(0, remainingDoses),
      totalDoses: Math.max(1, totalDoses),
      dosesPerIntake: Math.max(1, dosesPerIntake),
      refillThreshold: Math.max(0, refillThreshold),
    });
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="med-modal-title"
      onClose={onClose}
    >
      <div className="dialog-header">
        <h2 id="med-modal-title" className="dialog-title">
          {editing ? 'Edit Medication' : 'Add Medication'}
        </h2>
        <button type="button" className="icon-btn" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="dialog-body">
          <div className="grid-2">
            <div className="field">
              <label className="field-label" htmlFor="med-name">Medication Name *</label>
              <input
                id="med-name"
                className="input"
                type="text"
                required
                placeholder="e.g., Metformin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <span className="field-error">Error: Enter a medication name.</span>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="med-dosage">Dosage *</label>
              <input
                id="med-dosage"
                className="input"
                type="text"
                required
                placeholder="e.g., 1 tablet (500 mg)"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
              />
              <span className="field-error">Error: Enter dosage details.</span>
            </div>
          </div>

          <div className="field">
            <span className="field-label">Reminder Times</span>
            <div className="stack">
              {times.map((t, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="input tabular-nums"
                    type="time"
                    required
                    aria-label={`Reminder time ${idx + 1}`}
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
                      aria-label={`Remove time ${idx + 1}`}
                      onClick={() => setTimes(times.filter((_, i) => i !== idx))}
                    >
                      <Trash2 size={18} />
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
                <Plus size={16} /> Add Another Time
              </button>
            </div>
          </div>

          <div className="field">
            <span className="field-label">Repeat Days</span>
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
          </div>

          <div className="grid-2">
            <div className="field">
              <label className="field-label" htmlFor="med-food">Food Timing</label>
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

            <div className="field">
              <label className="field-label" htmlFor="med-tone">Alarm Sound</label>
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
                  onClick={() => alarmAudio.preview(tone, 0.85)}
                >
                  <Volume2 size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={trackStock}
                onChange={(e) => setTrackStock(e.target.checked)}
                style={{ width: 20, height: 20 }}
              />
              <span className="field-label">Track Pill Stock & Refill Alerts</span>
            </label>
          </div>

          {trackStock && (
            <div className="grid-2">
              <div className="field">
                <label className="field-label" htmlFor="med-remaining">Remaining Doses</label>
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
                <label className="field-label" htmlFor="med-threshold">Refill Alert At</label>
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
            <label className="field-label" htmlFor="med-notes">Notes (Optional)</label>
            <textarea
              id="med-notes"
              className="textarea"
              placeholder="e.g., Take with warm water"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="dialog-footer">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            {editing ? 'Save Changes' : 'Save Medication'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
