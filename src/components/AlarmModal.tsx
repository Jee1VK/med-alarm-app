import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Volume2, X } from 'lucide-react';
import type { AlarmTone, GeneralAlarm } from '../types';
import { alarmAudio } from '../utils/alarmAudio';
import { createId } from '../utils/storage';
import { DAY_LABELS } from '../utils/time';

interface AlarmModalProps {
  open: boolean;
  editing: GeneralAlarm | null;
  onClose: () => void;
  onSave: (alarm: GeneralAlarm) => void;
}

export function AlarmModal({ open, editing, onClose, onSave }: AlarmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [label, setLabel] = useState('Morning Alarm');
  const [time, setTime] = useState('07:00');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [tone, setTone] = useState<AlarmTone>('classic_bell');
  const [vibrate, setVibrate] = useState(true);

  useEffect(() => {
    if (editing) {
      setLabel(editing.label);
      setTime(editing.time);
      setDays(editing.days);
      setTone(editing.tone);
      setVibrate(editing.vibrate);
    } else {
      setLabel('Wake Up');
      setTime('07:00');
      setDays([1, 2, 3, 4, 5]);
      setTone('classic_bell');
      setVibrate(true);
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
    onSave({
      id: editing?.id ?? createId('alarm'),
      label: label.trim() || 'Alarm',
      time,
      days,
      tone,
      vibrate,
      enabled: editing?.enabled ?? true,
    });
    onClose();
  };

  return (
    <dialog ref={dialogRef} aria-labelledby="alarm-modal-title" onClose={onClose}>
      <div className="dialog-header">
        <h2 id="alarm-modal-title" className="dialog-title">
          {editing ? 'Edit Alarm' : 'New Alarm'}
        </h2>
        <button type="button" className="icon-btn" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="dialog-body">
          <div className="grid-2">
            <div className="field">
              <label className="field-label" htmlFor="alarm-time">Alarm Time *</label>
              <input
                id="alarm-time"
                className="input tabular-nums"
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                autoFocus
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="alarm-label">Label</label>
              <input
                id="alarm-label"
                className="input"
                type="text"
                placeholder="e.g., Wake Up"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <span className="field-label">Repeat Days (leave empty for one-time alarm)</span>
            <div className="days-grid" role="group" aria-label="Alarm repeat days">
              {DAY_LABELS.map((dLabel, idx) => (
                <button
                  key={dLabel}
                  type="button"
                  className="day-chip"
                  aria-pressed={days.includes(idx)}
                  onClick={() => toggleDay(idx)}
                >
                  {dLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="alarm-tone">Ringtone</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                id="alarm-tone"
                className="select"
                style={{ flex: 1 }}
                value={tone}
                onChange={(e) => setTone(e.target.value as AlarmTone)}
              >
                <option value="classic_bell">Classic Bell</option>
                <option value="temple_chime">Temple Chime</option>
                <option value="urgent_pulse">Urgent Pulse</option>
                <option value="gentle_dawn">Gentle Dawn</option>
              </select>
              <button
                type="button"
                className="icon-btn"
                aria-label="Preview ringtone"
                onClick={() => alarmAudio.preview(tone, 0.85)}
              >
                <Volume2 size={18} />
              </button>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={vibrate}
              onChange={(e) => setVibrate(e.target.checked)}
              style={{ width: 20, height: 20 }}
            />
            <span className="field-label">Vibrate on supported devices</span>
          </label>
        </div>

        <div className="dialog-footer">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            {editing ? 'Save Alarm' : 'Create Alarm'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
