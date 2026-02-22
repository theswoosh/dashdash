import type { FastifyPluginAsync } from 'fastify';
import type { Db } from '../db/index.js';
import type { Service } from '../config/schemas.js';

interface UserServiceRow {
  id: string;
  service_json: string;
}

export function createUserServicesRoutes(db: Db): FastifyPluginAsync {
  return async fastify => {
    const insert = db.prepare<[string, string]>(
      `INSERT INTO user_services (id, service_json, created_at, updated_at)
       VALUES (?, ?, datetime('now'), datetime('now'))`
    );
    const update = db.prepare<[string, string]>(
      `UPDATE user_services SET service_json = ?, updated_at = datetime('now') WHERE id = ?`
    );
    const remove = db.prepare<[string]>(
      `DELETE FROM user_services WHERE id = ?`
    );
    const selectOne = db.prepare<[string], UserServiceRow>(
      `SELECT id, service_json FROM user_services WHERE id = ?`
    );

    // POST /api/user-services — create a new user-defined widget instance
    fastify.post<{ Body: Service }>(
      '/user-services',
      async (request, reply) => {
        const service = request.body as Service;
        if (!service?.id || !service?.widget) {
          return reply.code(400).send({ ok: false, error: 'Missing required fields: id, widget' });
        }
        const serviceWithMeta: Service = { ...service, _userCreated: true };
        insert.run(service.id, JSON.stringify(serviceWithMeta));
        return reply.code(201).send({ ok: true, id: service.id, service: serviceWithMeta });
      }
    );

    // PATCH /api/user-services/:id — update options/title
    fastify.patch<{ Params: { id: string }; Body: Partial<Service> }>(
      '/user-services/:id',
      async (request, reply) => {
        const { id } = request.params;
        const row = selectOne.get(id);
        if (!row) {
          return reply.code(404).send({ ok: false, error: `Service '${id}' not found` });
        }
        const existing = JSON.parse(row.service_json) as Service;
        const updated: Service = { ...existing, ...request.body, id, _userCreated: true };
        update.run(JSON.stringify(updated), id);
        return { ok: true, service: updated };
      }
    );

    // DELETE /api/user-services/:id — remove a user-defined widget
    fastify.delete<{ Params: { id: string } }>(
      '/user-services/:id',
      async (request, reply) => {
        const { id } = request.params;
        const row = selectOne.get(id);
        if (!row) {
          return reply.code(404).send({ ok: false, error: `Service '${id}' not found` });
        }
        remove.run(id);
        return { ok: true };
      }
    );
  };
}
