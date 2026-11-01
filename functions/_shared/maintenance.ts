import { purgeDueAccounts } from "./accountPurge";

interface MaintenanceEnv {
  DB: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
}

// Rotina agendada (Cron Trigger do Worker espectro-chat, de hora em hora). Antes isso pegava carona nas
// requisições dos usuários (uma consulta de escrita a cada batimento e limpezas sorteadas).
export async function runMaintenance(env: MaintenanceEnv): Promise<{ purged: number }> {
  const purged = await purgeDueAccounts(env); // contas com prazo de exclusão vencido e sessões com mais de 6 meses
  await env.DB.batch([
    // Eventos de leitura ficam 90 dias (política de privacidade)
    env.DB.prepare("DELETE FROM post_events WHERE created_at < datetime('now', '-90 days')"),
    // Janelas do limitador de taxa com mais de 1 dia
    env.DB.prepare("DELETE FROM rate_limits WHERE window_start < CAST(strftime('%s', 'now') AS INTEGER) - 86400"),
  ]);
  return { purged };
}
