import { createWriteStream, createReadStream, existsSync, unlinkSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { pipeline } from 'stream/promises';
import type { FastifyPluginAsync } from 'fastify';
import type { Db } from '../db/index.js';
import {
  getDefaultBoard,
  getBoard,
  getUserBgExt,
  setUserBgExt,
  getUserWallpaperEnabled,
  setUserWallpaperEnabled,
} from '../db/boards.db.js';

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
};
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const URL_FETCH_TIMEOUT_MS = 15_000;

function parseHttpUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

function uploadsDir(configDir: string): string {
  const dir = join(configDir, 'uploads');
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Wallpaper files are stored per-user: {userId}-{boardId}{ext}
function bgPath(configDir: string, userId: string, boardId: string, ext: string): string {
  return join(uploadsDir(configDir), `${userId}-${boardId}${ext}`);
}

function removeOldBg(configDir: string, userId: string, boardId: string, ext: string | null): void {
  if (!ext) return;
  const old = bgPath(configDir, userId, boardId, ext);
  if (existsSync(old)) unlinkSync(old);
}

export function createBoardRoutes(db: Db, configDir: string): FastifyPluginAsync {
  return async fastify => {
    // GET /api/boards/default
    fastify.get('/boards/default', async (req, reply) => {
      const board = getDefaultBoard(db);
      if (!board) return reply.code(404).send({ error: 'No board found' });
      const bgExt = getUserBgExt(db, req.userId, board.id);
      const isWallpaperEnabled = getUserWallpaperEnabled(db, req.userId, board.id);
      return {
        id: board.id,
        name: board.name,
        slug: board.slug,
        hasBackground: bgExt !== null,
        wallpaperEnabled: isWallpaperEnabled,
      };
    });

    // PATCH /api/boards/:id — update per-user wallpaper toggle
    fastify.patch<{ Params: { id: string }; Body: { wallpaperEnabled?: boolean } }>(
      '/boards/:id',
      {
        schema: {
          params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
          body: { type: 'object', properties: { wallpaperEnabled: { type: 'boolean' } } },
        },
      },
      async (req, reply) => {
        const board = getBoard(db, req.params.id);
        if (!board) return reply.code(404).send({ error: 'Board not found' });
        if (req.body.wallpaperEnabled !== undefined) {
          setUserWallpaperEnabled(db, req.userId, board.id, req.body.wallpaperEnabled);
        }
        return { ok: true };
      }
    );

    // POST /api/boards/:id/background — multipart file upload (per-user)
    fastify.post<{ Params: { id: string } }>(
      '/boards/:id/background',
      async (req, reply) => {
        const board = getBoard(db, req.params.id);
        if (!board) return reply.code(404).send({ error: 'Board not found' });

        const uploadedFile = await req.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
        if (!uploadedFile) return reply.code(400).send({ error: 'No file uploaded' });

        const ext = extname(uploadedFile.filename).toLowerCase() || `.${uploadedFile.mimetype.split('/')[1]}`;
        if (!ALLOWED_EXTS.has(ext)) {
          return reply.code(415).send({ error: `Unsupported file type: ${ext}` });
        }

        removeOldBg(configDir, req.userId, board.id, getUserBgExt(db, req.userId, board.id));
        await pipeline(uploadedFile.file, createWriteStream(bgPath(configDir, req.userId, board.id, ext)));
        setUserBgExt(db, req.userId, board.id, ext);
        return { ok: true };
      }
    );

    // POST /api/boards/:id/background/from-url — fetch image from URL (per-user)
    fastify.post<{ Params: { id: string }; Body: { url: string } }>(
      '/boards/:id/background/from-url',
      {
        schema: {
          params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
          body: { type: 'object', required: ['url'], properties: { url: { type: 'string' } } },
        },
      },
      async (req, reply) => {
        const board = getBoard(db, req.params.id);
        if (!board) return reply.code(404).send({ error: 'Board not found' });

        const parsed = parseHttpUrl(req.body.url);
        if (!parsed) {
          return reply.code(400).send({ error: 'Invalid or non-HTTP URL' });
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
        try {
          const res = await fetch(req.body.url, { signal: controller.signal });
          if (!res.ok) return reply.code(502).send({ error: 'Failed to fetch image from URL' });

          const contentType = (res.headers.get('content-type') ?? '').split(';')[0]!.trim();
          const ext = MIME_TO_EXT[contentType];
          if (!ext) return reply.code(415).send({ error: `URL does not point to a supported image (got ${contentType})` });

          const chunks: Buffer[] = [];
          let total = 0;
          for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
            total += chunk.length;
            if (total > MAX_UPLOAD_BYTES) return reply.code(413).send({ error: 'Image exceeds 10 MB limit' });
            chunks.push(Buffer.from(chunk));
          }

          removeOldBg(configDir, req.userId, board.id, getUserBgExt(db, req.userId, board.id));
          writeFileSync(bgPath(configDir, req.userId, board.id, ext), Buffer.concat(chunks));
          setUserBgExt(db, req.userId, board.id, ext);
          return { ok: true };
        } finally {
          clearTimeout(timer);
        }
      }
    );

    // DELETE /api/boards/:id/background — remove per-user wallpaper
    fastify.delete<{ Params: { id: string } }>(
      '/boards/:id/background',
      async (req, reply) => {
        const board = getBoard(db, req.params.id);
        if (!board) return reply.code(404).send({ error: 'Board not found' });
        const bgExt = getUserBgExt(db, req.userId, board.id);
        if (!bgExt) return { ok: true };
        removeOldBg(configDir, req.userId, board.id, bgExt);
        setUserBgExt(db, req.userId, board.id, null);
        setUserWallpaperEnabled(db, req.userId, board.id, false);
        return { ok: true };
      }
    );

    // GET /api/boards/:id/background — serve the per-user wallpaper file
    fastify.get<{ Params: { id: string } }>(
      '/boards/:id/background',
      async (req, reply) => {
        const board = getBoard(db, req.params.id);
        if (!board) return reply.code(404).send({ error: 'Board not found' });
        const bgExt = getUserBgExt(db, req.userId, board.id);
        if (!bgExt) return reply.code(404).send({ error: 'No background set' });

        const file = bgPath(configDir, req.userId, board.id, bgExt);
        if (!existsSync(file)) return reply.code(404).send({ error: 'File not found' });

        const mimeMap: Record<string, string> = {
          '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
          '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
        };
        void reply.type(mimeMap[bgExt] ?? 'application/octet-stream');
        return reply.send(createReadStream(file));
      }
    );
  };
}
