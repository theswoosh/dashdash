import type { ChatMessage } from '@dashdash/types';

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

/** Preset swatches offered in the profile popup's chat color picker. */
export const CHAT_COLOR_PRESETS = [
  '#e63946', '#f4a261', '#e9c46a', '#2a9d8f',
  '#264653', '#457b9d', '#a8dadc', '#8ecae6',
  '#bde0fe', '#cdb4db', '#ffafcc', '#b5838d',
] as const;

/** FNV-1a hash → hue 0–360, fixed mid-lightness HSL — distinct on dark and light themes. */
export function hashColor(seed: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 62%)`;
}

/** Personal color if set and valid, else a deterministic hash color from the sender's identity. */
export function resolveSenderColor(message: ChatMessage): string {
  if (message.senderColor && HEX_COLOR_RE.test(message.senderColor)) return message.senderColor;
  return hashColor(message.userId ?? message.senderName);
}
