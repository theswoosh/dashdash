import type { FastifyPluginAsync } from 'fastify';
import type { Db } from '../db/index.js';

interface LayoutRow {
  layout_json: string;
}

interface GetQuery {
  board?: string;
}

interface PutBody {
  board?: string;
  layout: unknown[];
}

export function createLayoutRoutes(db: Db): FastifyPluginAsync {
  return async fastify => {
    // GET /api/layout?board=default
    fastify.get<{ Querystring: GetQuery }>('/layout', async req => {
      const boardId = req.query.board ?? 'default';
      const row = db
        .prepare('SELECT layout_json FROM layouts WHERE board_id = ?')
        .get(boardId) as LayoutRow | undefined;

      return { layout: row ? (JSON.parse(row.layout_json) as unknown[]) : null };
    });

    // PUT /api/layout  { board?, layout: LayoutItem[] }
    fastify.put<{ Body: PutBody }>(
      '/layout',
      {
        schema: {
          body: {
            type: 'object',
            required: ['layout'],
            properties: {
              board: { type: 'string' },
              layout: { type: 'array' },
            },
          },
        },
      },
      async (req, reply) => {
        const boardId = req.body.board ?? 'default';
        db.prepare(`
          INSERT INTO layouts (board_id, layout_json, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT (board_id) DO UPDATE SET
            layout_json = excluded.layout_json,
            updated_at  = excluded.updated_at
        `).run(boardId, JSON.stringify(req.body.layout));

        return reply.send({ ok: true });
      }
    );
  };
}
