import { createReadStream, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { FastifyPluginAsync } from 'fastify';

/**
 * Matches built-in theme wallpaper filenames, e.g. `ascii_bg.png`.
 * Group 1 captures the theme id. Shared with boards.route.ts for PATCH validation.
 */
export const BUILTIN_WALLPAPER_RE = /^([a-z0-9-]+)_bg\.(png|jpe?g|webp)$/;

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export function builtinWallpapersDir(configDir: string): string {
  return join(configDir, 'wallpapers');
}

interface BuiltinWallpaper {
  name: string;
  file: string;
  url: string;
}

function listBuiltinWallpapers(configDir: string): BuiltinWallpaper[] {
  const dir = builtinWallpapersDir(configDir);
  if (!existsSync(dir)) return [];

  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }

  const wallpapers: BuiltinWallpaper[] = [];
  for (const file of files) {
    const match = BUILTIN_WALLPAPER_RE.exec(file);
    if (!match) continue;
    wallpapers.push({ name: match[1]!, file, url: `/api/wallpapers/builtin/${file}` });
  }
  wallpapers.sort((a, b) => a.name.localeCompare(b.name));
  return wallpapers;
}

export function createWallpapersRoutes(configDir: string): FastifyPluginAsync {
  return async fastify => {
    // GET /api/wallpapers/builtin — list bundled theme wallpapers
    fastify.get('/wallpapers/builtin', async () => {
      return { wallpapers: listBuiltinWallpapers(configDir) };
    });

    // GET /api/wallpapers/builtin/:file — serve a bundled theme wallpaper image
    fastify.get<{ Params: { file: string } }>(
      '/wallpapers/builtin/:file',
      async (req, reply) => {
        const { file } = req.params;
        const match = BUILTIN_WALLPAPER_RE.exec(file);
        if (!match) return reply.code(404).send({ error: 'Wallpaper not found' });

        const filePath = join(builtinWallpapersDir(configDir), file);
        if (!existsSync(filePath)) return reply.code(404).send({ error: 'Wallpaper not found' });

        const ext = match[2]!;
        void reply.type(MIME_MAP[ext] ?? 'application/octet-stream');
        void reply.header('cache-control', 'public, max-age=604800, immutable');
        return reply.send(createReadStream(filePath));
      },
    );
  };
}
