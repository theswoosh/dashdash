import { useState, useEffect } from 'react';
import { useT } from '../i18n';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Defaults used to seed the picker when a widget/template has no bg_color yet.
export const DEFAULT_BG_HEX = '#4488ff';
export const DEFAULT_BG_ALPHA = 0.2;

function hexAlphaToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Parse an `rgb()/rgba()` string into hex + alpha; null if unparseable. */
export function parseRgba(rgba: string): { hex: string; alpha: number } | null {
  const m = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  const r = parseInt(m[1]!, 10);
  const g = parseInt(m[2]!, 10);
  const b = parseInt(m[3]!, 10);
  const alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
  const hex = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
  return { hex, alpha };
}

/** Build an `rgba()` string from hex + alpha (alpha rounded to 2 decimals). */
export function buildRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

interface BgColorPickerProps {
  readonly hex: string;
  readonly alpha: number;
  readonly hasValue: boolean;
  readonly onChange: (hex: string, alpha: number) => void;
  readonly onReset: () => void;
}

export function BgColorPicker({ hex, alpha, hasValue, onChange, onReset }: BgColorPickerProps) {
  const t = useT();
  const [hexDraft, setHexDraft] = useState(hex);

  // Sync draft when parent hex changes (e.g. reset, widget switch)
  useEffect(() => { setHexDraft(hex); }, [hex]);

  function handleHexChange(raw: string) {
    // Auto-prepend # if missing
    const val = raw.startsWith('#') ? raw : '#' + raw;
    setHexDraft(val);
    if (HEX_RE.test(val)) {
      onChange(val.toLowerCase(), alpha);
    }
  }

  function handleHexBlur() {
    if (!HEX_RE.test(hexDraft)) {
      setHexDraft(hex); // snap back to last valid
    }
  }

  return (
    <div className="config-bg-picker">
      <input
        type="color"
        className="config-color-input"
        value={hex}
        onChange={e => onChange(e.target.value, alpha)}
        title={t('widgetConfig.widgetBackground')}
      />
      <input
        type="text"
        className="config-hex-input"
        value={hexDraft}
        maxLength={7}
        spellCheck={false}
        onChange={e => handleHexChange(e.target.value)}
        onBlur={handleHexBlur}
        aria-label="Hex color"
      />
      <input
        type="range"
        className="config-alpha-slider"
        min="0"
        max="100"
        value={Math.round(alpha * 100)}
        onChange={e => onChange(hex, parseInt(e.target.value, 10) / 100)}
        title="Opacity"
      />
      <span className="config-alpha-value">{Math.round(alpha * 100)}%</span>
      <div
        className="config-bg-preview"
        style={{ background: hexAlphaToRgba(hex, alpha) }}
        title={hexAlphaToRgba(hex, alpha)}
      />
      <button
        className="config-reset-link"
        onClick={onReset}
        type="button"
        disabled={!hasValue}
      >
        {t('common.reset')}
      </button>
    </div>
  );
}
