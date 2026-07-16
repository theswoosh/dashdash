import { useState, useEffect } from 'react';
import { useT } from '../i18n';

interface Member { userId: string; name: string }
interface UserOption { id: string; name: string }

export function ChannelMembersPicker({ channelId }: { channelId: string }) {
  const t = useT();
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selected, setSelected] = useState('');

  const reload = () => {
    fetch(`/api/chat/channels/${channelId}/members`).then(r => r.json()).then(
      (d: { members: Member[] }) => setMembers(d.members),
    );
  };

  useEffect(() => {
    reload();
    // GET /api/users is admin-only and returns the user array directly (not { users: [] }).
    // Non-admin channel creators will get a 403 here and the dropdown stays empty.
    fetch('/api/users').then(r => r.ok ? r.json() : []).then((d: UserOption[]) => setUsers(d));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only depends on channelId, stable per mount
  }, [channelId]);

  const addMember = async () => {
    if (!selected) return;
    await fetch(`/api/chat/channels/${channelId}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selected }),
    });
    setSelected('');
    reload();
  };

  const removeMember = async (userId: string) => {
    await fetch(`/api/chat/channels/${channelId}/members/${userId}`, { method: 'DELETE' });
    reload();
  };

  const availableUsers = users.filter(u => !members.some(m => m.userId === u.id));

  return (
    <div className="channel-members-picker">
      <p className="channel-members-picker__hint">
        {members.length === 0 ? t('widgetConfig.chat.membersOpenHint') : t('widgetConfig.chat.membersRestrictedHint')}
      </p>
      <ul className="channel-members-picker__list">
        {members.map(m => (
          <li key={m.userId}>
            {m.name}
            <button type="button" onClick={() => void removeMember(m.userId)} aria-label={`Remove ${m.name}`}>✕</button>
          </li>
        ))}
      </ul>
      {availableUsers.length > 0 && (
        <div className="channel-members-picker__add">
          <select value={selected} onChange={e => setSelected(e.target.value)}>
            <option value="">{t('widgetConfig.chat.addMember')}</option>
            {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button type="button" onClick={() => void addMember()} disabled={!selected}>+</button>
        </div>
      )}
    </div>
  );
}
