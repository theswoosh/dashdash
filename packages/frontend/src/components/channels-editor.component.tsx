import { useState, useEffect } from 'react';
import type { ChatChannel } from '@dashdash/types';
import { useT } from '../i18n';
import { useAuth } from '../hooks/use-auth.hook';
import { useChatChannels } from '../widgets/chat/hooks/use-chat-channels.hook';
import { useHoldAction } from '../hooks/use-hold-action.hook';
import { ChannelMembersPicker } from './channel-members-picker.component';

const RETENTION_OPTIONS = [null, 7, 30, 60, 180, 365] as const;

function retentionLabelKey(days: number | null): string {
  return days === null ? 'widgetConfig.chat.retentionForever' : `widgetConfig.chat.retention${days}d`;
}

interface ChannelsEditorProps {
  value: unknown;
  onChange: (channelIds: string[]) => void;
  /** Lets the config modal flush an uncommitted draft (typed channel name,
   *  "+" not clicked) when the user hits Save. Returns the option patch to
   *  merge into the saved options, or null when there is nothing pending. */
  registerBeforeSave?: ((flush: () => Promise<Record<string, unknown> | null>) => void) | undefined;
}

function ChannelRow({
  channel,
  isSubscribed,
  canManage,
  onToggle,
  onChanged,
}: {
  channel: ChatChannel;
  isSubscribed: boolean;
  canManage: boolean;
  onToggle: (checked: boolean) => void;
  onChanged: () => void;
}) {
  const t = useT();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(channel.name);
  const [editRetention, setEditRetention] = useState<string>(String(channel.retentionDays ?? ''));
  const [editMarkdown, setEditMarkdown] = useState(channel.markdownEnabled);
  const [error, setError] = useState('');

  const deleteChannel = async () => {
    await fetch(`/api/chat/channels/${channel.id}`, { method: 'DELETE' });
    onChanged();
  };
  const { isHolding, startHold, cancelHold } = useHoldAction(deleteChannel, 800);

  const saveEdits = async () => {
    const res = await fetch(`/api/chat/channels/${channel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editName.trim(),
        retentionDays: editRetention === '' ? null : Number(editRetention),
        markdownEnabled: editMarkdown,
      }),
    });
    if (res.status === 409) {
      setError(t('widgetConfig.chat.channelExists'));
      return;
    }
    setError('');
    setIsEditing(false);
    onChanged();
  };

  if (isEditing) {
    return (
      <div className="channels-editor__row channels-editor__row--editing">
        <input
          className="config-input channels-editor__name-input"
          value={editName}
          maxLength={64}
          onChange={e => setEditName(e.target.value)}
        />
        <select
          className="config-input config-select channels-editor__retention"
          value={editRetention}
          onChange={e => setEditRetention(e.target.value)}
        >
          {RETENTION_OPTIONS.map(days => (
            <option key={days ?? 'forever'} value={days ?? ''}>
              {t(retentionLabelKey(days))}
            </option>
          ))}
        </select>
        <label className="channels-editor__markdown-toggle">
          <input
            type="checkbox"
            checked={editMarkdown}
            onChange={e => setEditMarkdown(e.target.checked)}
          />
          {t('widgetConfig.chat.markdownFormatting')}
        </label>
        <button type="button" className="channels-editor__btn" onClick={saveEdits} disabled={editName.trim().length === 0}>
          ✓
        </button>
        <button type="button" className="channels-editor__btn" onClick={() => { setIsEditing(false); setError(''); }}>
          ✕
        </button>
        {error && <span className="channels-editor__error">{error}</span>}
        {canManage && <ChannelMembersPicker channelId={channel.id} />}
      </div>
    );
  }

  return (
    <div className="channels-editor__row">
      <label className="channels-editor__label">
        <input type="checkbox" checked={isSubscribed} onChange={e => onToggle(e.target.checked)} />
        <span className="channels-editor__name">{channel.name}</span>
      </label>
      <span className="channels-editor__meta">{t(retentionLabelKey(channel.retentionDays))}</span>
      {canManage && (
        <>
          <button type="button" className="channels-editor__btn" onClick={() => setIsEditing(true)} aria-label={`Edit ${channel.name}`}>
            ✎
          </button>
          <button
            type="button"
            className={`channels-editor__btn channels-editor__btn--delete${isHolding ? ' channels-editor__btn--holding' : ''}`}
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            aria-label={t('widgetConfig.chat.holdToDeleteChannel')}
            title={t('widgetConfig.chat.holdToDeleteChannel')}
          >
            🗑
          </button>
        </>
      )}
    </div>
  );
}

export function ChannelsEditor({ value, onChange, registerBeforeSave }: ChannelsEditorProps) {
  const t = useT();
  const { user } = useAuth();
  const { channels, mutate } = useChatChannels();

  const [newName, setNewName] = useState('');
  const [newRetention, setNewRetention] = useState('');
  const [newMarkdown, setNewMarkdown] = useState(false);
  const [createError, setCreateError] = useState('');

  const subscribedIds = Array.isArray(value)
    ? (value as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];

  const toggleChannel = (channelId: string, checked: boolean) => {
    onChange(checked
      ? [...subscribedIds, channelId]
      : subscribedIds.filter(id => id !== channelId));
  };

  /** Creates the drafted channel (or subscribes the existing one on a name
   *  clash) and returns the updated subscription list; null when no draft. */
  const createDraftChannel = async (): Promise<string[] | null> => {
    const name = newName.trim();
    if (!name) return null;
    const res = await fetch('/api/chat/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        retentionDays: newRetention === '' ? null : Number(newRetention),
        markdownEnabled: newMarkdown,
      }),
    });
    let channelId: string;
    if (res.status === 409) {
      const existing = channels.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (!existing) {
        setCreateError(t('widgetConfig.chat.channelExists'));
        return null;
      }
      channelId = existing.id;
    } else if (res.ok) {
      channelId = ((await res.json()) as { channel: ChatChannel }).channel.id;
    } else {
      return null;
    }
    setCreateError('');
    setNewName('');
    setNewRetention('');
    setNewMarkdown(false);
    await mutate();
    const next = subscribedIds.includes(channelId) ? subscribedIds : [...subscribedIds, channelId];
    onChange(next); // auto-subscribe the new channel
    return next;
  };

  useEffect(() => {
    registerBeforeSave?.(async () => {
      const next = await createDraftChannel();
      return next ? { channelIds: next } : null;
    });
    // createDraftChannel closes over the current draft/subscription state.
  });

  const removeStaleSubscriptions = () => {
    void mutate();
  };

  return (
    <div className="channels-editor">
      {channels.map(channel => (
        <ChannelRow
          key={channel.id}
          channel={channel}
          isSubscribed={subscribedIds.includes(channel.id)}
          canManage={user?.role === 'admin' || (channel.createdBy !== null && channel.createdBy === user?.id)}
          onToggle={checked => toggleChannel(channel.id, checked)}
          onChanged={removeStaleSubscriptions}
        />
      ))}
      <div className="channels-editor__row channels-editor__row--create">
        <input
          className="config-input channels-editor__name-input"
          value={newName}
          maxLength={64}
          placeholder={t('widgetConfig.chat.newChannelPlaceholder')}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void createDraftChannel(); } }}
        />
        <select
          className="config-input config-select channels-editor__retention"
          value={newRetention}
          onChange={e => setNewRetention(e.target.value)}
          title={t('widgetConfig.chat.retention')}
        >
          {RETENTION_OPTIONS.map(days => (
            <option key={days ?? 'forever'} value={days ?? ''}>
              {t(retentionLabelKey(days))}
            </option>
          ))}
        </select>
        <label className="channels-editor__markdown-toggle">
          <input
            type="checkbox"
            checked={newMarkdown}
            onChange={e => setNewMarkdown(e.target.checked)}
          />
          {t('widgetConfig.chat.markdownFormatting')}
        </label>
        <button
          type="button"
          className="channels-editor__btn channels-editor__btn--add"
          onClick={() => void createDraftChannel()}
          disabled={newName.trim().length === 0}
          aria-label={t('widgetConfig.chat.createChannel')}
        >
          +
        </button>
      </div>
      {createError && <p className="channels-editor__error">{createError}</p>}
    </div>
  );
}
