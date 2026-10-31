import { errorResponse, serverError } from "../../_shared/auth";

export interface Env {
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
}

const SAFE_INLINE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
]);

// Impede que conteúdo enviado por usuários seja executado na origem do site (XSS via HTML/SVG)
function applySecurityHeaders(headers: Headers) {
  const type = (headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (!SAFE_INLINE_TYPES.has(type)) {
    headers.set("Content-Type", "application/octet-stream");
    headers.set("Content-Disposition", "attachment");
  }
}

const AUDIO_TYPES: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

const KEY_PATTERN = /^(images|videos|documents|audio)\/[\w.-]+$/;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env, params } = context;
    const bucket = env.MEDIA_BUCKET || env.BUCKET;

    if (!bucket) {
      return errorResponse("Cloudflare R2 Bucket não configurado.", 503);
    }

    const pathParam = params.path;
    const key = Array.isArray(pathParam) ? pathParam.join("/") : (pathParam || "");

    if (!key || !KEY_PATTERN.test(key)) {
      return errorResponse("Caminho do arquivo inválido.", 400);
    }

    // Suporte a HTTP Range requests para streaming suave e seeking de vídeos
    const object = await bucket.get(key, {
      range: request.headers,
      onlyIf: request.headers,
    });

    if (!object) {
      return errorResponse("Arquivo não encontrado no Cloudflare R2.", 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    // Adiciona Content-Type apropriado caso não venha no metadata
    if (!headers.get("content-type")) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.endsWith(".mp4")) headers.set("content-type", "video/mp4");
      else if (lowerKey.startsWith("audio/")) headers.set("content-type", AUDIO_TYPES[lowerKey.split(".").pop() || ""] || "application/octet-stream");
      else if (lowerKey.endsWith(".webm")) headers.set("content-type", "video/webm");
      else if (lowerKey.endsWith(".mov")) headers.set("content-type", "video/quicktime");
      else if (lowerKey.endsWith(".ogg")) headers.set("content-type", "video/ogg");
      else if (lowerKey.endsWith(".png")) headers.set("content-type", "image/png");
      else if (lowerKey.endsWith(".jpg") || lowerKey.endsWith(".jpeg")) headers.set("content-type", "image/jpeg");
      else if (lowerKey.endsWith(".webp")) headers.set("content-type", "image/webp");
      else if (lowerKey.endsWith(".gif")) headers.set("content-type", "image/gif");
    }

    applySecurityHeaders(headers);

    // Se objeto não tem body (ex: 304 Not Modified por conditional request)
    if (!("body" in object)) {
      return new Response(null, {
        status: 304,
        headers,
      });
    }

    // Se houve solicitação de range parcial (status 206)
    if ("range" in object && (object as any).range) {
      const r = (object as any).range;
      const offset = r.offset ?? 0;
      const length = r.length ?? object.size;
      headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
      headers.set("Content-Length", String(length));

      return new Response(object.body, {
        status: 206,
        headers,
      });
    }

    headers.set("Content-Length", String(object.size));
    return new Response(object.body, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    return serverError(err, "media/[[path]]");
  }
};

export const onRequestHead: PagesFunction<Env> = async (context) => {
  try {
    const { env, params } = context;
    const bucket = env.MEDIA_BUCKET || env.BUCKET;

    if (!bucket) {
      return new Response(null, { status: 503 });
    }

    const pathParam = params.path;
    const key = Array.isArray(pathParam) ? pathParam.join("/") : (pathParam || "");

    if (!key || !KEY_PATTERN.test(key)) {
      return new Response(null, { status: 400 });
    }

    const object = await bucket.head(key);
    if (!object) {
      return new Response(null, { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Length", String(object.size));
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    applySecurityHeaders(headers);

    return new Response(null, {
      status: 200,
      headers,
    });
  } catch {
    return new Response(null, { status: 500 });
  }
};
