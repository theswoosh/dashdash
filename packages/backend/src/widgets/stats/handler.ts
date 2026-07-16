import { cpus, freemem, totalmem, uptime } from 'os';
import { statfsSync, readFileSync } from 'fs';
import type { WidgetHandler, HandlerContext } from '../types.js';

// Root filesystem — dashdash always cares about the volume the app/container
// runs on, not per-mount breakdowns (out of scope; single-host tool).
const DISK_PATH = '/';

// Linux-only thermal zone path. Frequently absent in containers (host sensor
// data usually isn't bind-mounted) — treated as a soft no-op, same convention
// as Milestone 2's no-token case, never thrown.
const THERMAL_ZONE_PATH = '/sys/class/thermal/thermal_zone0/temp';

function getDiskUsedPct(): number | null {
  try {
    const stats = statfsSync(DISK_PATH);
    const total = stats.blocks * stats.bsize;
    const free = stats.bfree * stats.bsize;
    if (total <= 0) return null;
    return Math.round(((total - free) / total) * 100);
  } catch {
    return null;
  }
}

function getCpuTempC(): number | null {
  try {
    // thermal_zone*/temp is millidegrees Celsius.
    const raw = readFileSync(THERMAL_ZONE_PATH, 'utf8').trim();
    const milliDeg = Number(raw);
    if (!Number.isFinite(milliDeg)) return null;
    return Math.round(milliDeg / 100) / 10; // one decimal place
  } catch {
    return null;
  }
}

function getCpuLoad(): number {
  const cores = cpus();
  if (cores.length === 0) return 0;

  let totalIdle = 0;
  let totalTick = 0;

  for (const core of cores) {
    const times = core.times;
    totalIdle += times.idle;
    totalTick += times.idle + times.user + times.nice + times.sys + times.irq;
  }

  const idlePct = totalTick > 0 ? totalIdle / totalTick : 1;
  return Math.round((1 - idlePct) * 100);
}

export const statsHandler: WidgetHandler = {
  async fetchData(_options: Record<string, unknown>, _ctx: HandlerContext): Promise<unknown> {
    const free = freemem();
    const total = totalmem();
    const memUsedPct = total > 0 ? Math.round(((total - free) / total) * 100) : 0;

    return {
      cpuLoadPct: getCpuLoad(),
      memUsedPct,
      memUsedMb: Math.round((total - free) / 1024 / 1024),
      memTotalMb: Math.round(total / 1024 / 1024),
      uptimeSecs: Math.round(uptime()),
      diskUsedPct: getDiskUsedPct(),
      cpuTempC: getCpuTempC(),
    };
  },
};
