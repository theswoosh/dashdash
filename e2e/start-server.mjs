// Assembles a prod-like dashdash instance for the E2E suite:
// compiled backend serving the built SPA, with throwaway config/data dirs.
import { existsSync, rmSync, mkdirSync, cpSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const backendDist = join(repoRoot, 'packages/backend/dist/server.js');
const frontendDist = join(repoRoot, 'packages/frontend/dist/index.html');
const backendPublic = join(repoRoot, 'packages/backend/public');
const runtimeDir = join(repoRoot, 'e2e/.runtime');

if (!existsSync(backendDist) || !existsSync(frontendDist)) {
  console.error('[e2e] Missing build output — run `pnpm build` first.');
  process.exit(1);
}

// Backend serves ./public (sibling of dist/) when it exists.
rmSync(backendPublic, { recursive: true, force: true });
cpSync(join(repoRoot, 'packages/frontend/dist'), backendPublic, { recursive: true });

rmSync(runtimeDir, { recursive: true, force: true });
mkdirSync(join(runtimeDir, 'config'), { recursive: true });
mkdirSync(join(runtimeDir, 'data'), { recursive: true });

writeFileSync(join(runtimeDir, 'config', 'settings.yml'), 'title: e2e\n');
// Layout map (fine grid, pitch 14px): Clock is dragged to ~(28,18) by the
// drag-persist test — Block A/B and the Group frame must stay clear of that
// area and of each other. Notes is consumed by the hold-to-delete test.
writeFileSync(join(runtimeDir, 'config', 'services.yml'), `- title: Clock
  widget: clock
  layout: { x: 0, y: 0, w: 8, h: 8 }
  options:
    timezone: UTC
- title: Notes
  widget: notepad
  layout: { x: 12, y: 0, w: 8, h: 8 }
- title: Block A
  widget: clock
  layout: { x: 0, y: 14, w: 8, h: 8 }
  options:
    timezone: UTC
- title: Block B
  widget: clock
  layout: { x: 12, y: 14, w: 8, h: 8 }
  options:
    timezone: UTC
- title: Group
  widget: frame
  layout: { x: 44, y: 0, w: 24, h: 18 }
`);

const child = spawn(process.execPath, [backendDist], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: '4317',
    HOST: '127.0.0.1',
    DATA_DIR: join(runtimeDir, 'data'),
    CONFIG_DIR: join(runtimeDir, 'config'),
  },
});

child.on('exit', code => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
