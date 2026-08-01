/**
 * Métricas locais do client-local.
 */
const startTime = Date.now();

interface RequestMetric {
  count: number;
  errors: number;
  totalMs: number;
}

const routeMetrics = new Map<string, RequestMetric>();

export function recordRequest(route: string, durationMs: number, isError: boolean): void {
  let metric = routeMetrics.get(route);
  if (!metric) {
    metric = { count: 0, errors: 0, totalMs: 0 };
    routeMetrics.set(route, metric);
  }
  metric.count++;
  metric.totalMs += durationMs;
  if (isError) metric.errors++;
}

export function getMetrics() {
  const routes: Record<string, { count: number; errors: number; avgMs: number }> = {};
  for (const [route, m] of routeMetrics) {
    routes[route] = {
      count: m.count,
      errors: m.errors,
      avgMs: m.count > 0 ? Math.round(m.totalMs / m.count) : 0,
    };
  }

  return {
    uptime: Math.floor((Date.now() - startTime) / 1000),
    startedAt: new Date(startTime).toISOString(),
    routes,
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  };
}
