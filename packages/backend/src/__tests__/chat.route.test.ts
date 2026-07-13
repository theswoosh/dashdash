import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import { loginAsAdmin } from './test-helpers.js';
import { purgeExpiredChatMessages } from '../db/chat.db.js';

let server: FastifyInstance;
let db: Db;
let tmpDir: string;

async function setup() {
  tmpDir = mkdtempSync(join(tmpdir(), 'dashdash-chat-test-'));
  writeFileSync(join(tmpDir, 'services.yml'), '[]');
  writeFileSync(join(tmpDir, 'settings.yml'), 'title: test\n');
  ({ server, db } = await buildApp({ dataDir: tmpDir, configDir: tmpDir }));
  await server.ready();
}

async function teardown() {
  await server.close();
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
}

/** Registers + logs in a second (non-admin) user, returns its session cookie. */
async function loginAsUser(email = 'user@test.local', name = 'User'): Promise<string> {
  await server.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, password: 'password123', name },
  });
  const res = await server.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: 'password123' },
  });
  const setCookie = res.headers['set-cookie'];
  const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const sessionId = cookieHeader?.match(/dashdash_session=([^;]+)/)?.[1];
  if (!sessionId) throw new Error('Login did not set session cookie');
  return `dashdash_session=${sessionId}`;
}

async function createChannel(cookie: string, name = 'general', retentionDays?: number) {
  const res = await server.inject({
    method: 'POST',
    url: '/api/chat/channels',
    headers: { cookie },
    payload: retentionDays !== undefined ? { name, retentionDays } : { name },
  });
  return res;
}

async function postMessage(cookie: string, channelId: string, body: string) {
  return server.inject({
    method: 'POST',
    url: `/api/chat/channels/${channelId}/messages`,
    headers: { cookie },
    payload: { body },
  });
}

describe('chat routes', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('rejects unauthenticated access', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/chat/channels' });
    expect(res.statusCode).toBe(401);
  });

  describe('channels', () => {
    it('creates and lists channels', async () => {
      const cookie = await loginAsAdmin(server);
      const created = await createChannel(cookie, 'general');
      expect(created.statusCode).toBe(201);
      expect(created.json().channel.name).toBe('general');
      expect(created.json().channel.retentionDays).toBeNull();

      const list = await server.inject({ method: 'GET', url: '/api/chat/channels', headers: { cookie } });
      expect(list.statusCode).toBe(200);
      expect(list.json().channels).toHaveLength(1);
    });

    it('rejects duplicate channel names with 409 (case-insensitive)', async () => {
      const cookie = await loginAsAdmin(server);
      await createChannel(cookie, 'General');
      const dup = await createChannel(cookie, 'general');
      expect(dup.statusCode).toBe(409);
    });

    it('rejects invalid retention values', async () => {
      const cookie = await loginAsAdmin(server);
      const res = await createChannel(cookie, 'bad-retention', 42);
      expect(res.statusCode).toBe(400);
    });

    it('only creator or admin may rename/delete a channel', async () => {
      const adminCookie = await loginAsAdmin(server);
      const userCookie = await loginAsUser();
      const otherCookie = await loginAsUser('other@test.local', 'Other');

      const created = await createChannel(userCookie, 'mine');
      const channelId = created.json().channel.id as string;

      const forbidden = await server.inject({
        method: 'PATCH',
        url: `/api/chat/channels/${channelId}`,
        headers: { cookie: otherCookie },
        payload: { name: 'stolen' },
      });
      expect(forbidden.statusCode).toBe(403);

      const byCreator = await server.inject({
        method: 'PATCH',
        url: `/api/chat/channels/${channelId}`,
        headers: { cookie: userCookie },
        payload: { name: 'renamed', retentionDays: 60 },
      });
      expect(byCreator.statusCode).toBe(200);
      expect(byCreator.json().channel.name).toBe('renamed');
      expect(byCreator.json().channel.retentionDays).toBe(60);

      const deleteForbidden = await server.inject({
        method: 'DELETE',
        url: `/api/chat/channels/${channelId}`,
        headers: { cookie: otherCookie },
      });
      expect(deleteForbidden.statusCode).toBe(403);

      const deleteByAdmin = await server.inject({
        method: 'DELETE',
        url: `/api/chat/channels/${channelId}`,
        headers: { cookie: adminCookie },
      });
      expect(deleteByAdmin.statusCode).toBe(200);
    });
  });

  describe('messages', () => {
    it('posts and reads messages ascending with sender name', async () => {
      const cookie = await loginAsAdmin(server);
      const channelId = (await createChannel(cookie)).json().channel.id as string;

      await postMessage(cookie, channelId, 'first');
      await postMessage(cookie, channelId, 'second');

      const res = await server.inject({
        method: 'GET',
        url: `/api/chat/channels/${channelId}/messages`,
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      const { messages, hasMore } = res.json();
      expect(hasMore).toBe(false);
      expect(messages.map((m: { body: string }) => m.body)).toEqual(['first', 'second']);
      expect(messages[0].senderName).toBe('Admin');
      expect(messages[0].userId).toBeTruthy();
    });

    it('enforces the message length limit', async () => {
      const cookie = await loginAsAdmin(server);
      const channelId = (await createChannel(cookie)).json().channel.id as string;
      const res = await postMessage(cookie, channelId, 'x'.repeat(2001));
      expect(res.statusCode).toBe(400);
      const empty = await postMessage(cookie, channelId, '');
      expect(empty.statusCode).toBe(400);
    });

    it('paginates backwards with the before cursor without gaps or dupes', async () => {
      const cookie = await loginAsAdmin(server);
      const channelId = (await createChannel(cookie)).json().channel.id as string;

      for (let i = 0; i < 25; i++) {
        await postMessage(cookie, channelId, `msg-${i}`);
      }

      const seen: string[] = [];
      let before: string | undefined;
      let hasMore = true;
      while (hasMore) {
        const url = `/api/chat/channels/${channelId}/messages?limit=10${before ? `&before=${before}` : ''}`;
        const res = await server.inject({ method: 'GET', url, headers: { cookie } });
        expect(res.statusCode).toBe(200);
        const page = res.json();
        expect(page.messages.length).toBeLessThanOrEqual(10);
        // pages are ascending; prepend to keep global ascending order
        seen.unshift(...page.messages.map((m: { body: string }) => m.body));
        before = page.messages[0]?.id;
        hasMore = page.hasMore;
      }

      expect(seen).toEqual(Array.from({ length: 25 }, (_, i) => `msg-${i}`));
    });

    it('rejects an unknown cursor', async () => {
      const cookie = await loginAsAdmin(server);
      const channelId = (await createChannel(cookie)).json().channel.id as string;
      const res = await server.inject({
        method: 'GET',
        url: `/api/chat/channels/${channelId}/messages?before=nope`,
        headers: { cookie },
      });
      expect(res.statusCode).toBe(400);
    });

    it('keeps messages (userId null, senderName intact) after account deletion', async () => {
      const adminCookie = await loginAsAdmin(server);
      const userCookie = await loginAsUser();
      const channelId = (await createChannel(adminCookie)).json().channel.id as string;
      await postMessage(userCookie, channelId, 'survives');

      const users = await server.inject({ method: 'GET', url: '/api/users', headers: { cookie: adminCookie } });
      const user = users.json().find((u: { email: string }) => u.email === 'user@test.local');
      const del = await server.inject({
        method: 'DELETE',
        url: `/api/users/${user.id}`,
        headers: { cookie: adminCookie },
      });
      expect(del.statusCode).toBe(200);

      const res = await server.inject({
        method: 'GET',
        url: `/api/chat/channels/${channelId}/messages`,
        headers: { cookie: adminCookie },
      });
      const [message] = res.json().messages;
      expect(message.body).toBe('survives');
      expect(message.userId).toBeNull();
      expect(message.senderName).toBe('User');
    });
  });

  describe('sender color', () => {
    it('carries senderColor after the sender sets a chat color preference', async () => {
      const cookie = await loginAsAdmin(server);
      const channelId = (await createChannel(cookie)).json().channel.id as string;
      await postMessage(cookie, channelId, 'before color');

      const res = await server.inject({
        method: 'PUT',
        url: '/api/preferences',
        headers: { cookie },
        payload: { chatColor: '#ff00aa' },
      });
      expect(res.statusCode).toBe(200);

      await postMessage(cookie, channelId, 'after color');

      const list = await server.inject({
        method: 'GET',
        url: `/api/chat/channels/${channelId}/messages`,
        headers: { cookie },
      });
      const messages = list.json().messages as Array<{ body: string; senderColor: string | null }>;
      expect(messages.find(m => m.body === 'before color')?.senderColor).toBe('#ff00aa');
      expect(messages.find(m => m.body === 'after color')?.senderColor).toBe('#ff00aa');
    });

    it('is null when the sender has not set a chat color', async () => {
      const cookie = await loginAsAdmin(server);
      const channelId = (await createChannel(cookie)).json().channel.id as string;
      await postMessage(cookie, channelId, 'no color');

      const res = await server.inject({
        method: 'GET',
        url: `/api/chat/channels/${channelId}/messages`,
        headers: { cookie },
      });
      expect(res.json().messages[0].senderColor).toBeNull();
    });

    it('rejects invalid hex colors with 400', async () => {
      const cookie = await loginAsAdmin(server);
      const res = await server.inject({
        method: 'PUT',
        url: '/api/preferences',
        headers: { cookie },
        payload: { chatColor: 'red' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('clears back to null with an empty string', async () => {
      const cookie = await loginAsAdmin(server);
      await server.inject({
        method: 'PUT',
        url: '/api/preferences',
        headers: { cookie },
        payload: { chatColor: '#00ff00' },
      });
      const clear = await server.inject({
        method: 'PUT',
        url: '/api/preferences',
        headers: { cookie },
        payload: { chatColor: '' },
      });
      expect(clear.statusCode).toBe(200);

      const channelId = (await createChannel(cookie)).json().channel.id as string;
      await postMessage(cookie, channelId, 'cleared');
      const res = await server.inject({
        method: 'GET',
        url: `/api/chat/channels/${channelId}/messages`,
        headers: { cookie },
      });
      expect(res.json().messages[0].senderColor).toBeNull();
    });

    it('is null after the sender account is deleted (join on nulled user_id)', async () => {
      const adminCookie = await loginAsAdmin(server);
      const userCookie = await loginAsUser();
      await server.inject({
        method: 'PUT',
        url: '/api/preferences',
        headers: { cookie: userCookie },
        payload: { chatColor: '#123abc' },
      });
      const channelId = (await createChannel(adminCookie)).json().channel.id as string;
      await postMessage(userCookie, channelId, 'colored then deleted');

      const users = await server.inject({ method: 'GET', url: '/api/users', headers: { cookie: adminCookie } });
      const user = users.json().find((u: { email: string }) => u.email === 'user@test.local');
      await server.inject({
        method: 'DELETE',
        url: `/api/users/${user.id}`,
        headers: { cookie: adminCookie },
      });

      const res = await server.inject({
        method: 'GET',
        url: `/api/chat/channels/${channelId}/messages`,
        headers: { cookie: adminCookie },
      });
      expect(res.json().messages[0].senderColor).toBeNull();
    });
  });

  describe('search', () => {
    it('finds matches and escapes LIKE wildcards', async () => {
      const cookie = await loginAsAdmin(server);
      const channelId = (await createChannel(cookie)).json().channel.id as string;
      await postMessage(cookie, channelId, 'hello world');
      await postMessage(cookie, channelId, '100% done');
      await postMessage(cookie, channelId, 'unrelated');

      const match = await server.inject({
        method: 'GET',
        url: `/api/chat/channels/${channelId}/messages/search?q=world`,
        headers: { cookie },
      });
      expect(match.json().messages).toHaveLength(1);

      // '%' must be treated literally, not as a wildcard matching everything
      const percent = await server.inject({
        method: 'GET',
        url: `/api/chat/channels/${channelId}/messages/search?q=${encodeURIComponent('100%')}`,
        headers: { cookie },
      });
      expect(percent.json().messages).toHaveLength(1);
      expect(percent.json().messages[0].body).toBe('100% done');
    });
  });

  describe('retention purge', () => {
    it('purges only messages past their channel retention', async () => {
      const cookie = await loginAsAdmin(server);
      const retained = (await createChannel(cookie, 'retained', 7)).json().channel.id as string;
      const forever = (await createChannel(cookie, 'forever')).json().channel.id as string;

      await postMessage(cookie, retained, 'old in retained');
      await postMessage(cookie, retained, 'fresh in retained');
      await postMessage(cookie, forever, 'old in forever');

      // Backdate two messages past the 7-day window
      db.prepare(
        `UPDATE chat_messages SET created_at = datetime('now', '-10 days') WHERE body LIKE 'old%'`,
      ).run();

      const purged = purgeExpiredChatMessages(db);
      expect(purged).toBe(1);

      const retainedRes = await server.inject({
        method: 'GET',
        url: `/api/chat/channels/${retained}/messages`,
        headers: { cookie },
      });
      expect(retainedRes.json().messages.map((m: { body: string }) => m.body)).toEqual(['fresh in retained']);

      const foreverRes = await server.inject({
        method: 'GET',
        url: `/api/chat/channels/${forever}/messages`,
        headers: { cookie },
      });
      expect(foreverRes.json().messages).toHaveLength(1);
    });
  });
});
