import { absoluteMediaUrl, summarize, withPreview, type PreviewMeta } from "../_shared/preview";

interface Env {
  DB: D1Database;
}

// GET /u/:username: o app, com a prévia do perfil no <head> (nome, bio e foto)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params, next } = context;
  try {
    const username = String(params.username || "").slice(0, 60);
    if (!username) return await next();

    const user = await env.DB.prepare(
      "SELECT username, name, bio, avatar_url, is_private FROM users WHERE username = ? COLLATE NOCASE AND suspended_at IS NULL"
    )
      .bind(username)
      .first<{ username: string; name: string | null; bio: string | null; avatar_url: string | null; is_private: number }>();
    if (!user) return await next();

    const origin = new URL(request.url).origin;
    const fallbackImage = `${origin}/icons/icon-512.png`;
    const url = `${origin}/u/${encodeURIComponent(user.username)}`;
    let meta: PreviewMeta;

    if (user.is_private) {
      // Perfil privado: só o nome de usuário aparece
      meta = {
        title: `@${user.username} no Espectro`,
        description: "Perfil privado. Entre no Espectro para se conectar.",
        image: fallbackImage,
        url,
        type: "profile",
        largeImage: false,
        noindex: true,
      };
    } else {
      meta = {
        title: `${user.name?.trim() ? `${user.name.trim()} (@${user.username})` : `@${user.username}`} · Espectro`,
        description: summarize(user.bio) || `Conheça @${user.username} no Espectro.`,
        image: absoluteMediaUrl(origin, user.avatar_url) || fallbackImage,
        url,
        type: "profile",
        largeImage: false,
        noindex: false,
      };
    }

    return await withPreview(next, meta);
  } catch (err) {
    console.error("Prévia do perfil falhou:", err);
    return await next();
  }
};
