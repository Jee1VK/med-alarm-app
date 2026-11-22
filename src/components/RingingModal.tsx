import { useEffect, useRef, useState } from 'react';
import { BellRing, CheckCircle2, Clock, SkipForward } from 'lucide-react';
import type { RingingTarget } from '../types';
import { getMedPhoto } from '../utils/imageStore';
import { foodTimingLabel, formatTime } from '../utils/time';

interface RingingModalProps {
  target: RingingTarget | null;
  queueCount: number;
  use24Hour?: boolean;
  onMarkTaken: (target: RingingTarget) => void;
  onSnooze: (minutes: number) => void;
  onSkipMed: (target: RingingTarget) => void;
}

export function RingingModal({
  target,
  queueCount,
  use24Hour = false,
  onMarkTaken,
  onSnooze,
  onSkipMed,
}: RingingModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tabletPhotoUrl, setTabletPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (target && !dialog.open) {
      dialog.showModal();
    } else if (!target && dialog.open) {
      dialog.close();
    }
  }, [target]);

  useEffect(() => {
    if (!target || !target.hasTabletPhoto) return;
    let active = true;
    void getMedPhoto(target.itemId, 'tablet').then((url) => {
      if (active) setTabletPhotoUrl(url);
    });
    return () => {
      active = false;
    };
  }, [target]);

  const showPhoto = Boolean(target?.hasTabletPhoto && tabletPhotoUrl);

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
          {showPhoto && tabletPhotoUrl ? (
            <img
              src={tabletPhotoUrl}
              alt={`${target.title} tablet`}
              style={{
                width: 96,
                height: 96,
                borderRadius: 12,
                objectFit: 'cover',
                border: '2px solid rgba(255,255,255,0.75)',
                boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
              }}
            />
          ) : (
            <div className="ring-pulse" aria-hidden="true">
              <BellRing size={34} />
            </div>
          )}

          <div>
            <div className="badge badge--blue">
              {target.isTest
                ? 'Test Medication Alarm'
                : target.itemId.startsWith('cg:')
                  ? 'Caregiver Alert'
                  : 'Medication Alarm'}
              {queueCount > 1 ? ` (+${queueCount - 1} waiting)` : ''}
            </div>
            <h2
              id="ring-dialog-title"
              style={{
                margin: '10px 0 4px',
                fontFamily: 'var(--font-display)',
                fontSize: '1.85rem',
                lineHeight: 1.12,
                overflowWrap: 'anywhere',
              }}
            >
              {target.title}
            </h2>
            <p style={{ margin: 0, fontSize: '1.05rem', opacity: 0.92 }}>
              {target.subtitle} • <span className="tabular-nums">{formatTime(target.scheduledTime, use24Hour)}</span>
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
              {target.isTest
                ? 'Stop Test Alarm'
                : target.itemId.startsWith('cg:')
                  ? 'Dismiss Alert'
                  : 'Mark Taken'}
            </button>

            {!target.isTest && (
              <>
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

                {!target.itemId.startsWith('cg:') && (
                  <button
                    type="button"
                    className="ring-btn-ghost"
                    onClick={() => onSkipMed(target)}
                  >
                    <SkipForward size={16} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    Skip This Dose
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
