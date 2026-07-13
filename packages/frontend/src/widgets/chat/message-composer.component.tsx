import { useState, useCallback, useRef } from 'react';
import { useT } from '../../i18n';
import { EmojiPopup } from '../../components/emoji-picker.component';

const MAX_MESSAGE_LENGTH = 2000;
const COUNTER_THRESHOLD = MAX_MESSAGE_LENGTH - 200;

interface MessageComposerProps {
  onSend: (body: string) => Promise<void>;
  disabled?: boolean | undefined;
}

export function MessageComposer({ onSend, disabled }: MessageComposerProps) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const [emojiAnchor, setEmojiAnchor] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);

  const submitDraft = useCallback(() => {
    const body = draft.trim();
    if (!body || body.length > MAX_MESSAGE_LENGTH) return;
    setDraft('');
    onSend(body).catch(() => setDraft(body)); // restore draft on failure
  }, [draft, onSend]);

  // Panel stays open — the emoji button toggles it, so several emoji can be
  // picked in a row.
  const insertEmoji = useCallback((emoji: string) => {
    const input = inputRef.current;
    const at = input ? input.selectionStart : draft.length;
    setDraft(prev => prev.slice(0, at) + emoji + prev.slice(at));
    requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      const caret = at + emoji.length;
      input.setSelectionRange(caret, caret);
    });
  }, [draft.length]);

  return (
    <div className="chat-composer" ref={composerRef}>
      <button
        type="button"
        className="chat-composer__emoji"
        // Keep the popup's outside-press close from firing before the toggle,
        // which would close and immediately reopen the panel.
        onPointerDown={e => e.stopPropagation()}
        onClick={() =>
          setEmojiAnchor(prev =>
            prev ? null : composerRef.current?.getBoundingClientRect() ?? null,
          )
        }
        disabled={disabled}
        aria-label={t('chat.emoji')}
        title={t('chat.emoji')}
      >
        😊
      </button>
      {emojiAnchor && (
        <EmojiPopup anchorRect={emojiAnchor} onSelect={insertEmoji} onClose={() => setEmojiAnchor(null)} />
      )}
      <textarea
        ref={inputRef}
        className="chat-composer__input"
        value={draft}
        placeholder={t('chat.placeholder')}
        rows={1}
        maxLength={MAX_MESSAGE_LENGTH}
        disabled={disabled}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitDraft();
          }
        }}
      />
      {draft.length >= COUNTER_THRESHOLD && (
        <span className="chat-composer__counter">{draft.length} / {MAX_MESSAGE_LENGTH}</span>
      )}
      <button
        type="button"
        className="chat-composer__send"
        onClick={submitDraft}
        disabled={disabled || draft.trim().length === 0}
        aria-label={t('chat.send')}
      >
        ➤
      </button>
    </div>
  );
}
