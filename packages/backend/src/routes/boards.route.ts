import { createWriteStream, createReadStream, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';
import type { FastifyPluginAsync } from 'fastify';
import type { Db } from '../db/index.js';
import { getDefaultBoard, getBoard } from '../db/boards.db.js';
import {
  listWallpapers,
  insertWallpaper,
  deleteWallpaper,
  getActiveWallpaperId,
  setActiveWallpaperId,
} from '../db/wallpapers.db.js';
import { BUILTIN_WALLPAPER_RE } from './wallpapers.route.js';

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
};
const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
};
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

function uploadsDir(configDir: string): string {
  const dir = join(configDir, 'uploads');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function wallpaperFilePath(configDir: string, wallpaperId: string, ext: string): string {
  return join(uploadsDir(configDir), `${wallpaperId}${ext}`);
}

function resolveExt(filename: string, mimetype: string): string {
  const dotIdx = filename.lastIndexOf('.');
  const rawExt = dotIdx >= 0 ? filename.slice(dotIdx).toLowerCase() : '';
  return ALLOWED_EXTS.has(rawExt) ? rawExt : (MIME_TO_EXT[mimetype] ?? '');
}

export function createBoardRoutes(db: Db, configDir: string): FastifyPluginAsync {
  return async fastify => {
    // GET /api/boards/default — board meta with active wallpaper
    fastify.get('/boards/default', async (req, reply) => {
      const board = getDefaultBoard(db);
      if (!board) return reply.code(404).send({ error: 'No board found' });
      const activeWallpaperId = getActiveWallpaperId(db, req.userId, board.id);
      return {
        id: board.id,
        name: board.name,
        slug: board.slug,
        activeWallpaperId,
      };
    });

    // PATCH /api/boards/:id — set the active wallpaper. activeWallpaperId is
    // one of: an upload id, `builtin:<file>`, the literal 'none' (explicitly
    // no background), or null (theme default).
    fastify.patch<{ Params: { id: string }; Body: { activeWallpaperId?: string | null } }>(
      '/boards/:id',
      {
        schema: {
          params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
          body: {
            type: 'object',
            properties: {
              activeWallpaperId: { type: ['string', 'null'] },
            },
          },
        },
      },
      async (req, reply) => {
        const board = getBoard(db, req.params.id);
        if (!board) return reply.code(404).send({ error: 'Board not found' });
        if (req.body.activeWallpaperId !== undefined) {
          const value = req.body.activeWallpaperId;
          if (value !== null && value !== 'none') {
            if (value.startsWith('builtin:')) {
              const file = value.slice('builtin:'.length);
              if (!BUILTIN_WALLPAPER_RE.test(file)) {
                return reply.code(400).send({ error: 'Invalid built-in wallpaper' });
              }
            } else {
              const owned = listWallpapers(db, req.userId, board.id).some(w => w.id === value);
              if (!owned) return reply.code(400).send({ error: 'Invalid wallpaper id' });
            }
          }
          setActiveWallpaperId(db, req.userId, board.id, value);
        }
        return { ok: true };
      },
    );

    // GET /api/boards/:id/background — serve the active wallpaper file, but
    // ONLY for a user-uploaded active. Builtins, 'none', and the theme default
    // (null) all resolve client-side instead (see use-board.hook.ts) — this
    // endpoint 404s for all of them rather than trying to serve anything.
    fastify.get<{ Params: { id: string } }>(
      '/boards/:id/background',
      async (req, reply) => {
        const board = getBoard(db, req.params.id);
        if (!board) return reply.code(404).send({ error: 'Board not found' });

        const activeId = getActiveWallpaperId(db, req.userId, board.id);
        if (!activeId) return reply.code(404).send({ error: 'No active wallpaper' });
        if (activeId === 'none' || activeId.startsWith('builtin:')) {
          return reply.code(404).send({ error: 'No active wallpaper' });
        }

        const wallpapers = listWallpapers(db, req.userId, board.id);
        const wallpaper = wallpapers.find(w => w.id === activeId);
        if (!wallpaper) return reply.code(404).send({ error: 'Wallpaper not found' });

        const file = wallpaperFilePath(configDir, wallpaper.id, wallpaper.ext);
        if (!existsSync(file)) return reply.code(404).send({ error: 'File not found' });

        void reply.type(MIME_MAP[wallpaper.ext] ?? 'application/octet-stream');
        return reply.send(createReadStream(file));
      },
    );

    // GET /api/boards/:id/wallpapers — list all wallpapers for this user+board
    fastify.get<{ Params: { id: string } }>(
      '/boards/:id/wallpapers',
      async (req, reply) => {
        const board = getBoard(db, req.params.id);
        if (!board) return reply.code(404).send({ error: 'Board not found' });

        const wallpapers = listWallpapers(db, req.userId, board.id);
        return wallpapers.map(w => ({
          id: w.id,
          url: `/api/boards/${board.id}/wallpapers/${w.id}`,
          uploadedAt: w.uploaded_at,
        }));
      },
    );

    // POST /api/boards/:id/wallpapers — upload new wallpaper to the library
    fastify.post<{ Params: { id: string } }>(
      '/boards/:id/wallpapers',
      async (req, reply) => {
        const board = getBoard(db, req.params.id);
        if (!board) return reply.code(404).send({ error: 'Board not found' });

        const uploadedFile = await req.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
        if (!uploadedFile) return reply.code(400).send({ error: 'No file uploaded' });

        const ext = resolveExt(uploadedFile.filename, uploadedFile.mimetype);
        if (!ext) return reply.code(415).send({ error: 'Unsupported file type' });

        const wallpaperId = randomUUID();
        await pipeline(
          uploadedFile.file,
          createWriteStream(wallpaperFilePath(configDir, wallpaperId, ext)),
        );

        insertWallpaper(db, wallpaperId, req.userId, board.id, ext);
        return { id: wallpaperId, url: `/api/boards/${board.id}/wallpapers/${wallpaperId}` };
      },
    );

    // DELETE /api/boards/:id/wallpapers/:wid — remove wallpaper + clear active if needed
    fastify.delete<{ Params: { id: string; wid: string } }>(
      '/boards/:id/wallpapers/:wid',
      async (req, reply) => {
        const board = getBoard(db, req.params.id);
        if (!board) return reply.code(404).send({ error: 'Board not found' });

        const deleted = deleteWallpaper(db, req.userId, req.params.wid);
        if (!deleted) return reply.code(404).send({ error: 'Wallpaper not found' });

        const file = wallpaperFilePath(configDir, deleted.id, deleted.ext);
        if (existsSync(file)) unlinkSync(file);

        // Clear the active wallpaper assignment if it pointed to the deleted image.
        const activeId = getActiveWallpaperId(db, req.userId, board.id);
        if (activeId === deleted.id) {
          setActiveWallpaperId(db, req.userId, board.id, null);
        }

        return { ok: true };
      },
    );

    // GET /api/boards/:id/wallpapers/:wid — serve a specific wallpaper file (thumbnails)
    fastify.get<{ Params: { id: string; wid: string } }>(
      '/boards/:id/wallpapers/:wid',
      async (req, reply) => {
        const board = getBoard(db, req.params.id);
        if (!board) return reply.code(404).send({ error: 'Board not found' });

        const wallpapers = listWallpapers(db, req.userId, board.id);
        const wallpaper = wallpapers.find(w => w.id === req.params.wid);
        if (!wallpaper) return reply.code(404).send({ error: 'Wallpaper not found' });

        const file = wallpaperFilePath(configDir, wallpaper.id, wallpaper.ext);
        if (!existsSync(file)) return reply.code(404).send({ error: 'File not found' });

        void reply.type(MIME_MAP[wallpaper.ext] ?? 'application/octet-stream');
        return reply.send(createReadStream(file));
      },
    );
  };
}
