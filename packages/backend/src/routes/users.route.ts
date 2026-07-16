import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import {
  listUsers,
  findUserById,
  createUser,
  updateUser,
  deleteUser,
  countAdmins,
  findUserByEmail,
} from '../db/users.db.js';
import { hashPassword } from '../services/password.service.js';
import { destroyAllUserSessions } from '../db/sessions.db.js';
import { generateResetToken } from '../services/password.service.js';
import { sendPasswordResetEmail, isMailConfigured } from '../services/mail.service.js';
import type { MailConfig } from '../config/schemas.js';
import { randomUUID } from 'crypto';

const RESET_TOKEN_EXPIRES_SECONDS = 3600;

const CreateUserBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).trim(),
  role: z.enum(['admin', 'user']).optional().default('user'),
});

const UpdateUserBodySchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  role: z.enum(['admin', 'user']).optional(),
  isActive: z.boolean().optional(),
});

export function createUsersRoutes(db: Db, mailConfig: MailConfig): FastifyPluginAsync {
  return async (fastify) => {
    // GET /api/users
    fastify.get('/users', async (request, reply) => {
      if (request.userRole !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }
      return reply.send(listUsers(db));
    });

    // POST /api/users
    fastify.post('/users', async (request, reply) => {
      if (request.userRole !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      const parsed = CreateUserBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
      }

      const { email, password, name, role } = parsed.data;

      if (findUserByEmail(db, email)) {
        return reply.code(409).send({ error: 'Email already registered' });
      }

      const passwordHash = await hashPassword(password);
      const userId = createUser(db, { email, name, passwordHash, role });
      const user = findUserById(db, userId)!;

      return reply.code(201).send({ id: user.id, email: user.email, name: user.name, role: user.role });
    });

    // PATCH /api/users/:id
    fastify.patch<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
      if (request.userRole !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      const target = findUserById(db, request.params.id);
      if (!target) return reply.code(404).send({ error: 'User not found' });

      const parsed = UpdateUserBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Validation failed', details: parsed.error.issues });
      }

      const { name, role, isActive } = parsed.data;

      // Prevent demoting last admin.
      if (role === 'user' && target.role === 'admin' && countAdmins(db) <= 1) {
        return reply.code(409).send({ error: 'Cannot demote the last admin' });
      }

      const updates: import('../db/users.db.js').UpdateUserParams = {};
      if (name !== undefined) updates.name = name;
      if (role !== undefined) updates.role = role;
      if (isActive !== undefined) updates.isActive = isActive;
      updateUser(db, target.id, updates);
      return reply.send({ ok: true });
    });

    // DELETE /api/users/:id
    fastify.delete<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
      if (request.userRole !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      const target = findUserById(db, request.params.id);
      if (!target) return reply.code(404).send({ error: 'User not found' });

      if (target.role === 'admin') {
        return reply.code(403).send({ error: 'Admin accounts cannot be deleted' });
      }

      destroyAllUserSessions(db, target.id);
      deleteUser(db, target.id);
      return reply.send({ ok: true });
    });

    // POST /api/users/:id/reset-password — admin triggers reset email for a user
    fastify.post<{ Params: { id: string } }>('/users/:id/reset-password', async (request, reply) => {
      if (request.userRole !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      const target = findUserById(db, request.params.id);
      if (!target) return reply.code(404).send({ error: 'User not found' });

      const smtpConfig = {
        host: mailConfig.smtp.host,
        port: mailConfig.smtp.port,
        secure: mailConfig.smtp.secure,
        from: mailConfig.from,
      };

      if (!isMailConfigured(smtpConfig)) {
        return reply.code(503).send({ error: 'SMTP is not configured' });
      }

      const { raw, hash } = generateResetToken();
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_SECONDS * 1000).toISOString();

      db.prepare(`
        INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(randomUUID(), target.id, hash, expiresAt);

      const baseUrl = process.env['BOARD_BASE_URL'] ?? 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset-password?token=${raw}`;

      try {
        await sendPasswordResetEmail(smtpConfig, target.email, resetUrl);
      } catch (err) {
        fastify.log.error({ err }, 'Failed to send admin-triggered password reset email');
        return reply.code(502).send({ error: 'Failed to send email' });
      }

      return reply.send({ ok: true });
    });
  };
}
