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
  borderless?: boolean;
  headerIcon?: string;
  showBoardName?: boolean;
  headerClock?: boolean;
  headerClockFormat?: string;
  headerClockTimezone?: string;
  headerClockShowSeconds?: boolean;
  headerSearch?: boolean;
  headerSearchEngine?: string;
  headerSearchPlaceholder?: string;
  hideTopbar?: boolean;
  language?: string;
}

export function createPreferencesRoutes(db: Db): FastifyPluginAsync {
  return async fastify => {
    // GET /api/preferences
    fastify.get('/preferences', async req => {
      const rows = db
        .prepare<[string], PreferencesRow>('SELECT key, value FROM user_preferences WHERE user_id = ?')
        .all(req.userId);
      const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
      return {
        theme: map['theme'] ?? 'liquid-glass',
        darkMode: map['darkMode'] !== undefined ? map['darkMode'] === 'true' : true,
        boardName: map['boardName'] ?? '',
        borderless: map['borderless'] === 'true',
        headerIcon: map['headerIcon'] ?? '',
        showBoardName: map['showBoardName'] !== undefined ? map['showBoardName'] !== 'false' : true,
        headerClock: map['headerClock'] === 'true',
        headerClockFormat: map['headerClockFormat'] ?? '24h',
        headerClockTimezone: map['headerClockTimezone'] ?? '',
        headerClockShowSeconds: map['headerClockShowSeconds'] !== 'false',
        headerSearch: map['headerSearch'] === 'true',
        headerSearchEngine: map['headerSearchEngine'] ?? 'duckduckgo',
        headerSearchPlaceholder: map['headerSearchPlaceholder'] ?? '',
        hideTopbar: map['hideTopbar'] === 'true',
        language: map['language'] ?? '',
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
              borderless: { type: 'boolean' },
              headerIcon: { type: 'string' },
              showBoardName: { type: 'boolean' },
              headerClock: { type: 'boolean' },
              headerClockFormat: { type: 'string' },
              headerClockTimezone: { type: 'string' },
              headerClockShowSeconds: { type: 'boolean' },
              headerSearch: { type: 'boolean' },
              headerSearchEngine: { type: 'string' },
              headerSearchPlaceholder: { type: 'string' },
              hideTopbar: { type: 'boolean' },
              language: { type: 'string' },
            },
          },
        },
      },
      async (req, reply) => {
        const upsert = db.prepare(`
          INSERT INTO user_preferences (user_id, key, value, updated_at)
          VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `);

        const update = db.transaction((prefs: PutBody) => {
          if (prefs.theme !== undefined) upsert.run(req.userId, 'theme', prefs.theme);
          if (prefs.darkMode !== undefined) upsert.run(req.userId, 'darkMode', String(prefs.darkMode));
          if (prefs.boardName !== undefined) upsert.run(req.userId, 'boardName', prefs.boardName);
          if (prefs.borderless !== undefined) upsert.run(req.userId, 'borderless', String(prefs.borderless));
          if (prefs.headerIcon !== undefined) upsert.run(req.userId, 'headerIcon', prefs.headerIcon);
          if (prefs.showBoardName !== undefined) upsert.run(req.userId, 'showBoardName', String(prefs.showBoardName));
          if (prefs.headerClock !== undefined) upsert.run(req.userId, 'headerClock', String(prefs.headerClock));
          if (prefs.headerClockFormat !== undefined) upsert.run(req.userId, 'headerClockFormat', prefs.headerClockFormat);
          if (prefs.headerClockTimezone !== undefined) upsert.run(req.userId, 'headerClockTimezone', prefs.headerClockTimezone);
          if (prefs.headerClockShowSeconds !== undefined) upsert.run(req.userId, 'headerClockShowSeconds', String(prefs.headerClockShowSeconds));
          if (prefs.headerSearch !== undefined) upsert.run(req.userId, 'headerSearch', String(prefs.headerSearch));
          if (prefs.headerSearchEngine !== undefined) upsert.run(req.userId, 'headerSearchEngine', prefs.headerSearchEngine);
          if (prefs.headerSearchPlaceholder !== undefined) upsert.run(req.userId, 'headerSearchPlaceholder', prefs.headerSearchPlaceholder);
          if (prefs.hideTopbar !== undefined) upsert.run(req.userId, 'hideTopbar', String(prefs.hideTopbar));
          if (prefs.language !== undefined) upsert.run(req.userId, 'language', prefs.language);
        });

        update(req.body);
        return reply.send({ ok: true });
      }
    );
  };
}
