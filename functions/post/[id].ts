import { absoluteMediaUrl, summarize, withPreview, type PreviewMeta } from "../_shared/preview";

interface Env {
  DB: D1Database;
}

// GET /post/:id: o app, com a prévia da publicação no <head> (título, texto e imagem)
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, params, next } = context;
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) return await next();

    const post = await env.DB.prepare(
      `SELECT p.title, p.content, p.media_url, p.media_type, u.username, u.is_private
       FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?`
    )
      .bind(id)
      .first<{ title: string | null; content: string; media_url: string | null; media_type: string | null; username: string; is_private: number }>();
    if (!post) return await next();

    const origin = new URL(request.url).origin;
    const fallbackImage = `${origin}/icons/icon-512.png`;
    let meta: PreviewMeta;

    if (post.is_private) {
      // Perfil privado: a prévia não pode mostrar o que a pessoa escreveu
      meta = {
        title: "Publicação no Espectro",
        description: "Entre no Espectro para ver esta publicação.",
        image: fallbackImage,
        url: `${origin}/post/${id}`,
        type: "article",
        largeImage: false,
        noindex: true,
      };
    } else {
      const isPicture = post.media_type === "image" || post.media_type === "gif";
      const picture = isPicture ? absoluteMediaUrl(origin, post.media_url) : null;
      const text = summarize(post.content);
      meta = {
        title: `${post.title?.trim() || `Publicação de @${post.username}`} · Espectro`,
        description: text || (post.media_url ? `Publicação de @${post.username} no Espectro.` : "Veja esta publicação no Espectro."),
        image: picture || fallbackImage,
        url: `${origin}/post/${id}`,
        type: "article",
        largeImage: Boolean(picture),
        noindex: false,
      };
    }

    return await withPreview(next, meta);
  } catch (err) {
    console.error("Prévia da publicação falhou:", err);
    return await next();
  }
};
