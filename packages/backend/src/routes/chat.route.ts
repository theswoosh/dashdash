import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import {
  listChannels,
  findChannelById,
  createChannel,
  updateChannel,
  deleteChannel,
  listMessagesBefore,
  insertMessage,
  findMessageById,
  searchMessages,
} from '../db/chat.db.js';
import { findUserById } from '../db/users.db.js';

export const MAX_MESSAGE_LENGTH = 2000;
const MAX_CHANNEL_NAME_LENGTH = 64;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const MAX_SEARCH_RESULTS = 30;

const RETENTION_DAYS_VALUES = [7, 30, 60, 180, 365] as const;

const RetentionSchema = z
  .union([z.literal(null), z.number().int().refine(v => (RETENTION_DAYS_VALUES as readonly number[]).includes(v))])
  .optional();

const CreateChannelBodySchema = z.object({
  name: z.string().trim().min(1).max(MAX_CHANNEL_NAME_LENGTH),
  retentionDays: RetentionSchema,
});

const UpdateChannelBodySchema = z.object({
  name: z.string().trim().min(1).max(MAX_CHANNEL_NAME_LENGTH).optional(),
  retentionDays: RetentionSchema,
});

const PostMessageBodySchema = z.object({
  body: z.string().min(1).max(MAX_MESSAGE_LENGTH),
});

export function createChatRoutes(db: Db): FastifyPluginAsync {
  return async fastify => {
    const canManageChannel = (channelCreatedBy: string | null, userId: string, role: string) =>
      role === 'admin' || (channelCreatedBy !== null && channelCreatedBy === userId);

    // GET /api/chat/channels
    fastify.get('/chat/channels', async () => {
      return { channels: listChannels(db) };
    });

    // POST /api/chat/channels
    fastify.post('/chat/channels', async (request, reply) => {
      const parsed = CreateChannelBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid channel payload' });
      }
      try {
        const channel = createChannel(db, {
          name: parsed.data.name,
          retentionDays: parsed.data.retentionDays ?? null,
          createdBy: request.userId,
        });
        return reply.code(201).send({ channel });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('UNIQUE constraint failed')) {
          return reply.code(409).send({ error: 'A channel with this name already exists' });
        }
        throw err;
      }
    });

    // PATCH /api/chat/channels/:id
    fastify.patch<{ Params: { id: string } }>('/chat/channels/:id', async (request, reply) => {
      const channel = findChannelById(db, request.params.id);
      if (!channel) return reply.code(404).send({ error: 'Channel not found' });
      if (!canManageChannel(channel.createdBy, request.userId, request.userRole)) {
        return reply.code(403).send({ error: 'Only the channel creator or an admin can edit a channel' });
      }
      const parsed = UpdateChannelBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid channel payload' });
      }
      try {
        updateChannel(db, channel.id, parsed.data);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('UNIQUE constraint failed')) {
          return reply.code(409).send({ error: 'A channel with this name already exists' });
        }
        throw err;
      }
      return { channel: findChannelById(db, channel.id) };
    });

    // DELETE /api/chat/channels/:id — cascades the channel's messages
    fastify.delete<{ Params: { id: string } }>('/chat/channels/:id', async (request, reply) => {
      const channel = findChannelById(db, request.params.id);
      if (!channel) return reply.code(404).send({ error: 'Channel not found' });
      if (!canManageChannel(channel.createdBy, request.userId, request.userRole)) {
        return reply.code(403).send({ error: 'Only the channel creator or an admin can delete a channel' });
      }
      deleteChannel(db, channel.id);
      return { ok: true };
    });

    // GET /api/chat/channels/:id/messages?limit=&before=
    fastify.get<{ Params: { id: string }; Querystring: { limit?: string; before?: string } }>(
      '/chat/channels/:id/messages',
      async (request, reply) => {
        if (!findChannelById(db, request.params.id)) {
          return reply.code(404).send({ error: 'Channel not found' });
        }
        const rawLimit = Number(request.query.limit);
        const limit = Number.isInteger(rawLimit) && rawLimit > 0
          ? Math.min(rawLimit, MAX_PAGE_SIZE)
          : DEFAULT_PAGE_SIZE;
        const before = request.query.before;
        if (before !== undefined && !findMessageById(db, before)) {
          return reply.code(400).send({ error: 'Unknown cursor' });
        }
        return listMessagesBefore(db, request.params.id, limit, before);
      },
    );

    // POST /api/chat/channels/:id/messages
    fastify.post<{ Params: { id: string } }>('/chat/channels/:id/messages', async (request, reply) => {
      if (!findChannelById(db, request.params.id)) {
        return reply.code(404).send({ error: 'Channel not found' });
      }
      const parsed = PostMessageBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: `Message must be 1–${MAX_MESSAGE_LENGTH} characters` });
      }
      const sender = findUserById(db, request.userId);
      if (!sender) return reply.code(401).send({ error: 'Unknown user' });
      const message = insertMessage(db, {
        channelId: request.params.id,
        userId: sender.id,
        senderName: sender.name,
        body: parsed.data.body,
      });
      return reply.code(201).send({ message });
    });

    // GET /api/chat/channels/:id/messages/search?q=
    fastify.get<{ Params: { id: string }; Querystring: { q?: string; limit?: string } }>(
      '/chat/channels/:id/messages/search',
      async (request, reply) => {
        if (!findChannelById(db, request.params.id)) {
          return reply.code(404).send({ error: 'Channel not found' });
        }
        const query = (request.query.q ?? '').trim();
        if (!query) return { messages: [] };
        const rawLimit = Number(request.query.limit);
        const limit = Number.isInteger(rawLimit) && rawLimit > 0
          ? Math.min(rawLimit, MAX_SEARCH_RESULTS)
          : MAX_SEARCH_RESULTS;
        return { messages: searchMessages(db, request.params.id, query, limit) };
      },
    );
  };
}
