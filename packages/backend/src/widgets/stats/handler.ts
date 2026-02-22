import { cpus, freemem, totalmem, uptime } from 'os';
import type { WidgetHandler, HandlerContext } from '../types.js';

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
    };
  },
};
