import { useState, useEffect } from 'react';
import { useT } from '../i18n';
import { COLOR_TOKENS, parseTokenValue, tokenCssVar, tokenI18nKey, type ColorToken } from '../utils/color-tokens';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Defaults used to seed the picker when a widget/template has no bg_color yet.
export const DEFAULT_BG_HEX = '#4488ff';
export const DEFAULT_BG_ALPHA = 0.2;
// Defaults for the font-color picker (near-white, fully opaque).
export const DEFAULT_FG_HEX = '#e8e8ee';
export const DEFAULT_FG_ALPHA = 1;

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
  /** Raw current option value (hex/rgba/`token:<name>`/undefined). Only
   * needed to drive the "Theme colors" tab — omit to keep the picker as a
   * Custom-only color editor (e.g. per-bookmark link colors). */
  readonly rawValue?: string | null | undefined;
  readonly onSelectToken?: ((token: ColorToken) => void) | undefined;
}

export function BgColorPicker({ hex, alpha, hasValue, onChange, onReset, rawValue, onSelectToken }: BgColorPickerProps) {
  const t = useT();
  const [hexDraft, setHexDraft] = useState(hex);
  const supportsTokens = onSelectToken !== undefined;
  const currentToken = supportsTokens ? parseTokenValue(rawValue) : null;
  const [tab, setTab] = useState<'theme' | 'custom'>(currentToken ? 'theme' : 'custom');

  // Sync draft when parent hex changes (e.g. reset, widget switch)
  useEffect(() => { setHexDraft(hex); }, [hex]);

  // Re-sync the active tab when the underlying value changes from outside
  // (widget switch, reset, clipboard paste) — not on purely-local tab clicks.
  useEffect(() => {
    if (supportsTokens) setTab(parseTokenValue(rawValue) ? 'theme' : 'custom');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawValue]);

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

  const customPicker = (
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
        onWheel={e => {
          // Mousewheel nudges opacity by 1 % — the slider is short, precise
          // values are hard to hit by dragging (dashtest #11 decision).
          const next = Math.min(100, Math.max(0, Math.round(alpha * 100) + (e.deltaY < 0 ? 1 : -1)));
          onChange(hex, next / 100);
        }}
        title="Opacity"
      />
      <input
        type="number"
        className="config-alpha-input"
        min={0}
        max={100}
        value={Math.round(alpha * 100)}
        onChange={e => {
          const parsed = Number(e.target.value);
          if (Number.isFinite(parsed)) {
            onChange(hex, Math.min(100, Math.max(0, Math.round(parsed))) / 100);
          }
        }}
        aria-label="Opacity percent"
      />
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

  if (!supportsTokens) return customPicker;

  return (
    <div className="config-color-picker">
      <div className="config-color-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'theme'}
          className={`config-color-tab${tab === 'theme' ? ' config-color-tab--active' : ''}`}
          onClick={() => setTab('theme')}
        >
          {t('widgetConfig.colors.themeTab')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'custom'}
          className={`config-color-tab${tab === 'custom' ? ' config-color-tab--active' : ''}`}
          onClick={() => setTab('custom')}
        >
          {t('widgetConfig.colors.customTab')}
        </button>
      </div>
      {tab === 'theme' ? (
        <div className="config-color-swatches">
          {COLOR_TOKENS.map(token => (
            <button
              key={token}
              type="button"
              className={`config-color-swatch${currentToken === token ? ' config-color-swatch--active' : ''}`}
              style={{ background: `var(${tokenCssVar(token)})` }}
              onClick={() => onSelectToken?.(token)}
              title={t(tokenI18nKey(token))}
              aria-label={t(tokenI18nKey(token))}
              aria-pressed={currentToken === token}
            />
          ))}
          <button
            className="config-reset-link"
            onClick={onReset}
            type="button"
            disabled={!hasValue}
          >
            {t('common.reset')}
          </button>
        </div>
      ) : customPicker}
    </div>
  );
}
