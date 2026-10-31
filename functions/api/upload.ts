import { getAuthUser, jsonResponse, errorResponse } from "../_shared/auth";

export interface Env {
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
  JWT_SECRET?: string;
  DB?: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    // Autenticação: apenas usuários autenticados podem enviar arquivos
    const user = await getAuthUser(request, env.JWT_SECRET || "troque-este-segredo");
    if (!user) {
      return errorResponse("Não autenticado. Faça login para enviar arquivos.", 401);
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return errorResponse("Formato inválido. Esperado multipart/form-data.", 400);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const uploadContext = formData.get("context") || new URL(request.url).searchParams.get("context");

    if (!file || typeof file === "string") {
      return errorResponse("Nenhum arquivo enviado no campo 'file'.", 400);
    }

    const fileObj = file as File;
    const mimeType = fileObj.type || "application/octet-stream";
    const isVideo = mimeType.startsWith("video/") || /\.(mp4|webm|mov|ogg|m4v)$/i.test(fileObj.name);
    const isImage = mimeType.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileObj.name);
    const isFile = !isVideo && !isImage;

    // Limite específico para Chat: máximo de 10MB por arquivo
    if (uploadContext === "chat") {
      const MAX_CHAT_SIZE = 10 * 1024 * 1024; // 10MB
      if (fileObj.size > MAX_CHAT_SIZE) {
        const sizeMb = (fileObj.size / (1024 * 1024)).toFixed(1);
        return errorResponse(
          `O arquivo selecionado possui ${sizeMb} MB. O limite máximo permitido para envio no chat é de 10 MB por arquivo.`,
          400
        );
      }
    }

    // Limite geral de tamanho: 100MB
    const MAX_SIZE = 100 * 1024 * 1024;
    if (fileObj.size > MAX_SIZE) {
      return errorResponse("Arquivo excede o tamanho máximo permitido de 100MB.", 400);
    }

    const extFromName = fileObj.name.includes(".") ? fileObj.name.split(".").pop() : "";
    const ext = extFromName ? extFromName.toLowerCase() : (isVideo ? "mp4" : isImage ? "jpg" : "bin");
    const folder = isVideo ? "videos" : isImage ? "images" : "documents";
    const uniqueId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const key = `${folder}/${uniqueId}.${ext}`;

    const mediaType = isVideo ? "video" : isImage ? "image" : "file";

    const bucket = env.MEDIA_BUCKET || env.BUCKET;

    if (bucket) {
      await bucket.put(key, fileObj.stream(), {
        httpMetadata: {
          contentType: mimeType,
        },
        customMetadata: {
          originalName: fileObj.name,
          size: String(fileObj.size),
          uploadedBy: String(user.id),
          uploaderName: user.username,
          uploadedAt: new Date().toISOString(),
        },
      });

      return jsonResponse({
        url: `/api/media/${key}`,
        key,
        media_type: mediaType,
        filename: fileObj.name,
        size: fileObj.size,
        content_type: mimeType,
      });
    }

    // Fallback se R2 não estiver configurado no ambiente local
    return jsonResponse({
      url: `/api/media/${key}`,
      key,
      media_type: mediaType,
      filename: fileObj.name,
      size: fileObj.size,
      content_type: mimeType,
      warning: "Bucket R2 não configurado no ambiente. URL gerada para visualização.",
    });
  } catch (err: any) {
    return errorResponse(`Erro ao processar upload: ${err.message || String(err)}`, 500);
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
};
