import { randomUUID } from 'crypto';
import type { ChatChannel, ChatMessage } from '@dashdash/types';
import type { Db } from './index.js';

interface ChannelRow {
  id: string;
  name: string;
  retention_days: number | null;
  created_by: string | null;
  created_at: string;
}

interface MessageRow {
  seq: number;
  id: string;
  channel_id: string;
  user_id: string | null;
  sender_name: string;
  sender_color: string | null;
  body: string;
  created_at: string;
}

function toChannel(row: ChannelRow): ChatChannel {
  return {
    id: row.id,
    name: row.name,
    retentionDays: row.retention_days,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function toMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    channelId: row.channel_id,
    userId: row.user_id,
    senderName: row.sender_name,
    senderColor: row.sender_color,
    body: row.body,
    createdAt: row.created_at,
  };
}

// ── Channels ───────────────────────────────────────────────────────────────

export function listChannels(db: Db): ChatChannel[] {
  const rows = db
    .prepare('SELECT * FROM chat_channels ORDER BY created_at ASC, name ASC')
    .all() as ChannelRow[];
  return rows.map(toChannel);
}

export function findChannelById(db: Db, id: string): ChatChannel | undefined {
  const row = db.prepare('SELECT * FROM chat_channels WHERE id = ?').get(id) as ChannelRow | undefined;
  return row ? toChannel(row) : undefined;
}

export function createChannel(
  db: Db,
  params: { name: string; retentionDays: number | null; createdBy: string },
): ChatChannel {
  const id = randomUUID();
  db.prepare(
    'INSERT INTO chat_channels (id, name, retention_days, created_by) VALUES (?, ?, ?, ?)',
  ).run(id, params.name.trim(), params.retentionDays, params.createdBy);
  return findChannelById(db, id)!;
}

export function updateChannel(
  db: Db,
  id: string,
  params: { name?: string | undefined; retentionDays?: number | null | undefined },
): void {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (params.name !== undefined) { sets.push('name = ?'); values.push(params.name.trim()); }
  if (params.retentionDays !== undefined) { sets.push('retention_days = ?'); values.push(params.retentionDays); }
  if (sets.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE chat_channels SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteChannel(db: Db, id: string): void {
  db.prepare('DELETE FROM chat_channels WHERE id = ?').run(id);
}

// ── Messages ───────────────────────────────────────────────────────────────

/**
 * Returns up to `limit` messages of a channel, ascending (oldest first).
 * `beforeId` pages backwards: only messages inserted before the referenced
 * message are returned. Ordering/cursor use the monotonic `seq` column —
 * created_at is second-precision and random UUIDs don't sort by send order.
 */
export function listMessagesBefore(
  db: Db,
  channelId: string,
  limit: number,
  beforeId?: string,
): { messages: ChatMessage[]; hasMore: boolean } {
  let rows: MessageRow[];
  if (beforeId) {
    rows = db.prepare(
      `SELECT chat_messages.*, up.value AS sender_color
       FROM chat_messages
       LEFT JOIN user_preferences up ON up.user_id = chat_messages.user_id AND up.key = 'chatColor'
       WHERE chat_messages.channel_id = ?
         AND chat_messages.seq < (SELECT seq FROM chat_messages WHERE id = ?)
       ORDER BY chat_messages.seq DESC
       LIMIT ?`,
    ).all(channelId, beforeId, limit + 1) as MessageRow[];
  } else {
    rows = db.prepare(
      `SELECT chat_messages.*, up.value AS sender_color
       FROM chat_messages
       LEFT JOIN user_preferences up ON up.user_id = chat_messages.user_id AND up.key = 'chatColor'
       WHERE chat_messages.channel_id = ?
       ORDER BY chat_messages.seq DESC
       LIMIT ?`,
    ).all(channelId, limit + 1) as MessageRow[];
  }

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  return { messages: page.map(toMessage), hasMore };
}

export function insertMessage(
  db: Db,
  params: { channelId: string; userId: string; senderName: string; body: string },
): ChatMessage {
  const id = randomUUID();
  db.prepare(
    'INSERT INTO chat_messages (id, channel_id, user_id, sender_name, body) VALUES (?, ?, ?, ?, ?)',
  ).run(id, params.channelId, params.userId, params.senderName, params.body);
  const row = db.prepare(
    `SELECT chat_messages.*, up.value AS sender_color
     FROM chat_messages
     LEFT JOIN user_preferences up ON up.user_id = chat_messages.user_id AND up.key = 'chatColor'
     WHERE chat_messages.id = ?`,
  ).get(id) as MessageRow;
  return toMessage(row);
}

export function findMessageById(db: Db, id: string): ChatMessage | undefined {
  const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id) as MessageRow | undefined;
  return row ? toMessage(row) : undefined;
}

export function deleteMessage(db: Db, id: string): void {
  db.prepare('DELETE FROM chat_messages WHERE id = ?').run(id);
}

/** LIKE search within one channel, newest first. `%`, `_` and `\` in the query are escaped. */
export function searchMessages(db: Db, channelId: string, query: string, limit: number): ChatMessage[] {
  const escaped = query.replace(/[\\%_]/g, ch => `\\${ch}`);
  const rows = db.prepare(
    `SELECT chat_messages.*, up.value AS sender_color
     FROM chat_messages
     LEFT JOIN user_preferences up ON up.user_id = chat_messages.user_id AND up.key = 'chatColor'
     WHERE chat_messages.channel_id = ? AND chat_messages.body LIKE ? ESCAPE '\\'
     ORDER BY chat_messages.seq DESC
     LIMIT ?`,
  ).all(channelId, `%${escaped}%`, limit) as MessageRow[];
  return rows.map(toMessage);
}

/** Deletes messages past their channel's retention window. Returns rows deleted. */
export function purgeExpiredChatMessages(db: Db): number {
  const result = db.prepare(
    `DELETE FROM chat_messages WHERE id IN (
       SELECT m.id FROM chat_messages m
       JOIN chat_channels c ON c.id = m.channel_id
       WHERE c.retention_days IS NOT NULL
         AND m.created_at < datetime('now', '-' || c.retention_days || ' days')
     )`,
  ).run();
  return result.changes;
}
