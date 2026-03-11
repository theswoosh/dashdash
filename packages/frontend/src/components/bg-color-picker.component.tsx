import { useState, useEffect } from 'react';
import { useT } from '../i18n';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

interface BgColorPickerProps {
  readonly hex: string;
  readonly alpha: number;
  readonly hasValue: boolean;
  readonly previewColor: string | undefined;
  readonly onChange: (hex: string, alpha: number) => void;
  readonly onReset: () => void;
}

export function BgColorPicker({ hex, alpha, hasValue, previewColor, onChange, onReset }: BgColorPickerProps) {
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
    <>
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
        {hasValue && (
          <div
            className="config-bg-preview"
            style={{ background: previewColor }}
          />
        )}
      </div>
      {hasValue && (
        <button className="config-reset-link" onClick={onReset} type="button">
          {t('common.reset')}
        </button>
      )}
    </>
  );
}
