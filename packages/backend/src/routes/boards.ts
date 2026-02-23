import { createWriteStream, createReadStream, existsSync, unlinkSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { pipeline } from 'stream/promises';
import type { FastifyPluginAsync } from 'fastify';
import type { Db } from '../db/index.js';
import { getDefaultBoard, getBoard, setBackgroundExt, setWallpaperEnabled } from '../db/boards.js';

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
};
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function uploadsDir(configDir: string): string {
  const dir = join(configDir, 'uploads');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function bgPath(configDir: string, boardId: string, ext: string): string {
  return join(uploadsDir(configDir), `${boardId}${ext}`);
}

function removeOldBg(configDir: string, boardId: string, ext: string | null): void {
  if (!ext) return;
  const old = bgPath(configDir, boardId, ext);
  if (existsSync(old)) unlinkSync(old);
}

export function createBoardRoutes(db: Db, configDir: string): FastifyPluginAsync {
  return async fastify => {
    // GET /api/boards/default
    fastify.get('/boards/default', async (_req, reply) => {
      const board = getDefaultBoard(db);
      if (!board) return reply.code(404).send({ error: 'No board found' });
      return {
        id: board.id,
        name: board.name,
        slug: board.slug,
        hasBackground: board.background_ext !== null,
        wallpaperEnabled: board.wallpaper_enabled === 1,
      };
    });

    // PATCH /api/boards/:id — update board settings (wallpaperEnabled, etc.)
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
          setWallpaperEnabled(db, board.id, req.body.wallpaperEnabled);
        }
        return { ok: true };
      }
    );

    // POST /api/boards/:id/background — multipart file upload
    fastify.post<{ Params: { id: string } }>(
      '/boards/:id/background',
      async (req, reply) => {
        const board = getBoard(db, req.params.id);
        if (!board) return reply.code(404).send({ error: 'Board not found' });

        const data = await req.file({ limits: { fileSize: MAX_BYTES } });
        if (!data) return reply.code(400).send({ error: 'No file uploaded' });

        const ext = extname(data.filename).toLowerCase() || `.${data.mimetype.split('/')[1]}`;
        if (!ALLOWED_EXTS.has(ext)) {
          return reply.code(415).send({ error: `Unsupported file type: ${ext}` });
        }

        removeOldBg(configDir, board.id, board.background_ext);
        await pipeline(data.file, createWriteStream(bgPath(configDir, board.id, ext)));
        setBackgroundExt(db, board.id, ext);
        return { ok: true };
      }
    );

    // POST /api/boards/:id/background/from-url — fetch image from URL (browser drag-drop)
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

        let parsed: URL;
        try { parsed = new URL(req.body.url); } catch {
          return reply.code(400).send({ error: 'Invalid URL' });
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return reply.code(400).send({ error: 'Only http/https URLs allowed' });
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15_000);
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
            if (total > MAX_BYTES) return reply.code(413).send({ error: 'Image exceeds 10 MB limit' });
            chunks.push(Buffer.from(chunk));
          }

          removeOldBg(configDir, board.id, board.background_ext);
          writeFileSync(bgPath(configDir, board.id, ext), Buffer.concat(chunks));
          setBackgroundExt(db, board.id, ext);
          return { ok: true };
        } finally {
          clearTimeout(timer);
        }
      }
    );

    // DELETE /api/boards/:id/background
    fastify.delete<{ Params: { id: string } }>(
      '/boards/:id/background',
      async (req, reply) => {
        const board = getBoard(db, req.params.id);
        if (!board) return reply.code(404).send({ error: 'Board not found' });
        if (!board.background_ext) return { ok: true };
        removeOldBg(configDir, board.id, board.background_ext);
        setBackgroundExt(db, board.id, null);
        return { ok: true };
      }
    );

    // GET /api/boards/:id/background — serve the image file
    fastify.get<{ Params: { id: string } }>(
      '/boards/:id/background',
      async (req, reply) => {
        const board = getBoard(db, req.params.id);
        if (!board?.background_ext) return reply.code(404).send({ error: 'No background set' });

        const file = bgPath(configDir, board.id, board.background_ext);
        if (!existsSync(file)) return reply.code(404).send({ error: 'File not found' });

        const mimeMap: Record<string, string> = {
          '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
          '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
        };
        void reply.type(mimeMap[board.background_ext] ?? 'application/octet-stream');
        return reply.send(createReadStream(file));
      }
    );
  };
}
