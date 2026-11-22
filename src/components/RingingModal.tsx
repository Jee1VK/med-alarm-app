import { useEffect, useRef } from 'react';
import { BellRing, CheckCircle2, Clock, SkipForward } from 'lucide-react';
import type { RingingTarget } from '../types';
import { foodTimingLabel, formatTime12h } from '../utils/time';

interface RingingModalProps {
  target: RingingTarget | null;
  queueCount: number;
  onMarkTaken: (target: RingingTarget) => void;
  onSnooze: (minutes: number) => void;
  onSkipMed: (target: RingingTarget) => void;
}

export function RingingModal({
  target,
  queueCount,
  onMarkTaken,
  onSnooze,
  onSkipMed,
}: RingingModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (target && !dialog.open) {
      dialog.showModal();
    } else if (!target && dialog.open) {
      dialog.close();
    }
  }, [target]);

  return (
    <dialog
      ref={dialogRef}
      className="ring-dialog ring-dialog--med"
      aria-labelledby="ring-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
      }}
    >
      {target && (
        <div className="ring-dialog__inner">
          <div className="ring-pulse" aria-hidden="true">
            <BellRing size={34} />
          </div>

          <div>
            <div className="badge badge--blue">
              Medication Alarm
              {queueCount > 1 ? ` (+${queueCount - 1} waiting)` : ''}
            </div>
            <h2
              id="ring-dialog-title"
              style={{
                margin: '10px 0 4px',
                fontFamily: 'var(--font-display)',
                fontSize: '2rem',
                lineHeight: 1.1,
              }}
            >
              {target.title}
            </h2>
            <p style={{ margin: 0, fontSize: '1.05rem', opacity: 0.92 }}>
              {target.subtitle} • <span className="tabular-nums">{formatTime12h(target.scheduledTime)}</span>
            </p>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.12)',
              padding: '10px 14px',
              borderRadius: '6px',
              width: '100%',
              fontSize: '0.92rem',
            }}
          >
            <strong>Instruction:</strong> {foodTimingLabel(target.foodTiming)}
            {target.notes ? ` — ${target.notes}` : ''}
          </div>

          <div className="ring-actions">
            <button
              type="button"
              className="ring-btn-take"
              autoFocus
              onClick={() => onMarkTaken(target)}
            >
              <CheckCircle2 size={20} aria-hidden="true" />
              Mark Taken
            </button>

            <div className="ring-btn-snooze-row">
              <button
                type="button"
                className="ring-btn-ghost"
                onClick={() => onSnooze(5)}
              >
                <Clock size={16} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Snooze 5m
              </button>
              <button
                type="button"
                className="ring-btn-ghost"
                onClick={() => onSnooze(10)}
              >
                <Clock size={16} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Snooze 10m
              </button>
            </div>

            <button
              type="button"
              className="ring-btn-ghost"
              onClick={() => onSkipMed(target)}
            >
              <SkipForward size={16} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Skip This Dose
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
