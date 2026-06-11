// Pre-compresses dist/ assets to .gz/.br siblings at build time so the backend
// can serve them via @fastify/static `preCompressed` with zero runtime CPU cost.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const DIST_DIR = new URL('../dist', import.meta.url).pathname;
const COMPRESSIBLE_EXTENSIONS = new Set(['.js', '.css', '.html', '.svg', '.json', '.txt', '.map']);
const MIN_SIZE_BYTES = 1024; // tiny files gain nothing from compression

function* walkFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkFiles(path);
    else yield path;
  }
}

let compressedCount = 0;
for (const path of walkFiles(DIST_DIR)) {
  if (!COMPRESSIBLE_EXTENSIONS.has(extname(path))) continue;
  if (statSync(path).size < MIN_SIZE_BYTES) continue;

  const content = readFileSync(path);
  writeFileSync(`${path}.gz`, gzipSync(content, { level: 9 }));
  writeFileSync(`${path}.br`, brotliCompressSync(content, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }));
  compressedCount++;
}

console.log(`[precompress] ${compressedCount} files compressed to .gz/.br in dist/`);
