import type { FastifyPluginAsync } from 'fastify';
import type { Db } from '../db/index.js';

interface NotepadRow {
  service_id: string;
  content: string;
}

export function createNotepadRoutes(db: Db): FastifyPluginAsync {
  return async fastify => {
    const select = db.prepare<[string], NotepadRow>(
      `SELECT service_id, content FROM notepad WHERE service_id = ?`
    );
    const upsert = db.prepare<[string, string]>(
      `INSERT INTO notepad (service_id, content, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(service_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`
    );
    const deleteRow = db.prepare<[string]>(
      `DELETE FROM notepad WHERE service_id = ?`
    );

    // GET /api/notepad/:serviceId
    fastify.get<{ Params: { serviceId: string } }>(
      '/notepad/:serviceId',
      async (request) => {
        const row = select.get(request.params.serviceId);
        return { content: row?.content ?? '' };
      }
    );

    // PUT /api/notepad/:serviceId
    fastify.put<{ Params: { serviceId: string }; Body: { content: string } }>(
      '/notepad/:serviceId',
      async (request, reply) => {
        const { serviceId } = request.params;
        const { content } = request.body;
        if (typeof content !== 'string' || content.length > 100_000) {
          return reply.code(400).send({ ok: false, error: 'content must be a string under 100 KB' });
        }
        upsert.run(serviceId, content);
        return { ok: true };
      }
    );

    // DELETE /api/notepad/:serviceId — clear stored content
    fastify.delete<{ Params: { serviceId: string } }>(
      '/notepad/:serviceId',
      async (request) => {
        deleteRow.run(request.params.serviceId);
        return { ok: true };
      }
    );
  };
}
