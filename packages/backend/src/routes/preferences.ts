import type { FastifyPluginAsync } from 'fastify';
import type { Db } from '../db/index.js';

interface PreferencesRow {
  key: string;
  value: string;
}

interface PutBody {
  theme?: string;
  darkMode?: boolean;
  boardName?: string;
}

export function createPreferencesRoutes(db: Db): FastifyPluginAsync {
  return async fastify => {
    // GET /api/preferences
    fastify.get('/preferences', async () => {
      const rows = db.prepare<[], PreferencesRow>('SELECT key, value FROM user_preferences').all();
      const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
      return {
        theme: map['theme'] ?? 'liquid-glass',
        darkMode: map['darkMode'] !== undefined ? map['darkMode'] === 'true' : true,
        boardName: map['boardName'] ?? '',
      };
    });

    // PUT /api/preferences
    fastify.put<{ Body: PutBody }>(
      '/preferences',
      {
        schema: {
          body: {
            type: 'object',
            properties: {
              theme: { type: 'string' },
              darkMode: { type: 'boolean' },
              boardName: { type: 'string' },
            },
          },
        },
      },
      async (req, reply) => {
        const upsert = db.prepare(`
          INSERT INTO user_preferences (key, value, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `);

        const update = db.transaction((prefs: PutBody) => {
          if (prefs.theme !== undefined) upsert.run('theme', prefs.theme);
          if (prefs.darkMode !== undefined) upsert.run('darkMode', String(prefs.darkMode));
          if (prefs.boardName !== undefined) upsert.run('boardName', prefs.boardName);
        });

        update(req.body);
        return reply.send({ ok: true });
      }
    );
  };
}
