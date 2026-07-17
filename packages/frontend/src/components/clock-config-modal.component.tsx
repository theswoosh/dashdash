import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useT } from '../i18n';
import { TimezonePicker } from './timezone-picker.component';

export interface ClockConfigPatch {
  headerClockFormat?: string;
  headerClockShowSeconds?: boolean;
  headerClockTimezone?: string;
}

interface Props {
  format: string;
  showSeconds: boolean;
  timezone: string;
  settingsTimezone: string | undefined;
  onSave: (patch: ClockConfigPatch) => void;
  onClose: () => void;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ClockConfigModal({ format, showSeconds, timezone, settingsTimezone, onSave, onClose }: Props) {
  const t = useT();
  const [localTimezone, setLocalTimezone] = useState(timezone);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusables = modal.querySelectorAll<HTMLElement>(FOCUSABLE);
    focusables[0]?.focus();

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = modal.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (els.length === 0) return;
      const first = els[0]!;
      const last = els[els.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [onClose]);

  return createPortal(
    <div className="chrome modal-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal modal--sm"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('topbar.clockSettings')}
      >
        <div className="modal-header">
          <span className="modal-title">{t('topbar.clockSettings')}</span>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="config-field">
            <label className="config-label">{t('topbar.format')}</label>
            <select
              className="config-input config-select"
              value={format}
              onChange={e => onSave({ headerClockFormat: e.target.value })}
            >
              <option value="24h">{t('topbar.clockFormat24h')}</option>
              <option value="12h">{t('topbar.clockFormat12h')}</option>
            </select>
          </div>

          <label className="config-field config-field--checkbox">
            <input
              type="checkbox"
              checked={showSeconds}
              onChange={e => onSave({ headerClockShowSeconds: e.target.checked })}
            />
            <span>{t('topbar.showSeconds')}</span>
          </label>

          <div className="config-field">
            <label className="config-label">
              {t('topbar.timezone')}
              {settingsTimezone && !localTimezone && (
                <span className="config-label__counter">default: {settingsTimezone}</span>
              )}
            </label>
            <TimezonePicker
              value={localTimezone}
              placeholder={settingsTimezone ? `From settings.yaml: ${settingsTimezone}` : 'e.g. America/New_York'}
              onChange={tz => { setLocalTimezone(tz); onSave({ headerClockTimezone: tz }); }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <div />
          <div className="modal-footer-actions">
            <button className="modal-btn modal-btn--primary" onClick={onClose}>{t('common.done')}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
