import { useState, useEffect } from 'react';
import { useT } from '../i18n';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function hexAlphaToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
