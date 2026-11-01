import { jsonResponse, serverError } from "../../_shared/auth";
import { AdminEnv, requireAdmin } from "../../_shared/admin";

interface Row {
  name: string;
  device: string;
  path: string;
  value: number;
  rating: string;
}

// Percentil 75: é o número que o Google usa para dizer se um site está "bom"
function percentile75(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.75) - 1)];
}

// GET /api/admin/vitals?days=7: desempenho real por métrica, aparelho e página de entrada
export const onRequestGet: PagesFunction<AdminEnv> = async (context) => {
  try {
    const { request, env } = context;
    const admin = await requireAdmin(request, env);
    if (admin instanceof Response) return admin;

    const daysParam = Number(new URL(request.url).searchParams.get("days"));
    const days = Number.isInteger(daysParam) ? Math.min(30, Math.max(1, daysParam)) : 7;

    const { results } = await env.DB.prepare(
      `SELECT name, device, path, value, rating FROM web_vitals
       WHERE created_at >= datetime('now', ?) ORDER BY id DESC LIMIT 20000`
    )
      .bind(`-${days} days`)
      .all<Row>();
    const rows = results || [];

    const byMetric = new Map<string, Row[]>();
    for (const row of rows) {
      const key = `${row.name}|${row.device}`;
      byMetric.set(key, [...(byMetric.get(key) || []), row]);
    }

    const metrics = [...byMetric.entries()].map(([key, group]) => {
      const [name, device] = key.split("|");
      return {
        name,
        device,
        count: group.length,
        p75: percentile75(group.map((r) => r.value)),
        good: group.filter((r) => r.rating === "good").length,
        needs: group.filter((r) => r.rating === "needs-improvement").length,
        poor: group.filter((r) => r.rating === "poor").length,
      };
    });

    // Páginas de entrada mais lentas (LCP), com pelo menos 2 medições
    const byPath = new Map<string, number[]>();
    for (const row of rows) {
      if (row.name === "LCP") byPath.set(row.path, [...(byPath.get(row.path) || []), row.value]);
    }
    const pages = [...byPath.entries()]
      .filter(([, values]) => values.length >= 2)
      .map(([path, values]) => ({ path, count: values.length, p75: percentile75(values) }))
      .sort((a, b) => b.p75 - a.p75)
      .slice(0, 8);

    return jsonResponse({ days, total: rows.length, metrics, pages });
  } catch (err: unknown) {
    return serverError(err, "admin/vitals");
  }
};
