import { errorResponse } from "../../_shared/auth";

export interface Env {
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const { request, env, params } = context;
    const bucket = env.MEDIA_BUCKET || env.BUCKET;

    if (!bucket) {
      return errorResponse("Cloudflare R2 Bucket não configurado.", 503);
    }

    const pathParam = params.path;
    const key = Array.isArray(pathParam) ? pathParam.join("/") : (pathParam || "");

    if (!key) {
      return errorResponse("Caminho do arquivo não informado.", 400);
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
      else if (lowerKey.endsWith(".webm")) headers.set("content-type", "video/webm");
      else if (lowerKey.endsWith(".mov")) headers.set("content-type", "video/quicktime");
      else if (lowerKey.endsWith(".ogg")) headers.set("content-type", "video/ogg");
      else if (lowerKey.endsWith(".png")) headers.set("content-type", "image/png");
      else if (lowerKey.endsWith(".jpg") || lowerKey.endsWith(".jpeg")) headers.set("content-type", "image/jpeg");
      else if (lowerKey.endsWith(".webp")) headers.set("content-type", "image/webp");
      else if (lowerKey.endsWith(".gif")) headers.set("content-type", "image/gif");
    }

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
    return errorResponse(`Erro ao transmitir mídia: ${err.message || String(err)}`, 500);
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

    if (!key) {
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

    return new Response(null, {
      status: 200,
      headers,
    });
  } catch {
    return new Response(null, { status: 500 });
  }
};
