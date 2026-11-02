import { getAuthUser, jsonResponse, errorResponse, getJwtSecret, rateLimit } from "../_shared/auth";

export interface Env {
  MEDIA_BUCKET?: R2Bucket;
  BUCKET?: R2Bucket;
  JWT_SECRET?: string;
  DB?: D1Database;
}

type Kind = "image" | "video" | "file" | "audio";

const AUDIO_EXT: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

// Allowlist: extensão -> tipo canônico. O Content-Type enviado pelo cliente nunca é usado.
const ALLOWED: Record<string, { mime: string; kind: Kind }> = {
  jpg: { mime: "image/jpeg", kind: "image" },
  jpeg: { mime: "image/jpeg", kind: "image" },
  png: { mime: "image/png", kind: "image" },
  gif: { mime: "image/gif", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
  mp4: { mime: "video/mp4", kind: "video" },
  m4v: { mime: "video/mp4", kind: "video" },
  webm: { mime: "video/webm", kind: "video" },
  mov: { mime: "video/quicktime", kind: "video" },
  ogg: { mime: "video/ogg", kind: "video" },
  pdf: { mime: "application/pdf", kind: "file" },
  txt: { mime: "text/plain", kind: "file" },
  csv: { mime: "text/csv", kind: "file" },
  zip: { mime: "application/zip", kind: "file" },
  doc: { mime: "application/msword", kind: "file" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "file" },
  xls: { mime: "application/vnd.ms-excel", kind: "file" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "file" },
  ppt: { mime: "application/vnd.ms-powerpoint", kind: "file" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", kind: "file" },
};

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((b, i) => bytes[offset + i] === b);
}

// Confere os primeiros bytes para imagens e PDF, evitando HTML/SVG renomeado
function magicBytesMatch(ext: string, bytes: Uint8Array): boolean {
  switch (ext) {
    case "jpg":
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
    case "gif":
      return startsWith(bytes, [0x47, 0x49, 0x46, 0x38]);
    case "webp":
      return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
    case "pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]);
    default:
      return true;
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const { request, env } = context;

    const user = await getAuthUser(request, getJwtSecret(env));
    if (!user) {
      return errorResponse("Não autenticado. Faça login para enviar arquivos.", 401);
    }

    if (env.DB) {
      const limited = await rateLimit(env.DB, request, "upload", 30, 600, user.id);
      if (limited) return limited;
    }

    const bucket = env.MEDIA_BUCKET || env.BUCKET;
    if (!bucket) {
      return errorResponse("Armazenamento de mídia indisponível.", 503);
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

    const extFromName = fileObj.name.includes(".") ? fileObj.name.split(".").pop()!.toLowerCase() : "";
    const isAudioUpload = uploadContext === "audio" && extFromName in AUDIO_EXT;
    const allowed = isAudioUpload
      ? { mime: AUDIO_EXT[extFromName], kind: "audio" as Kind }
      : ALLOWED[extFromName];
    if (!allowed) {
      return errorResponse("Tipo de arquivo não permitido.", 415);
    }

    const declared = (fileObj.type || "").toLowerCase();
    if (declared && declared !== "application/octet-stream") {
      const declaredKind = declared.split("/")[0];
      const expectedKind = allowed.kind === "file" ? declaredKind : allowed.kind;
      if (declaredKind !== expectedKind) {
        return errorResponse("O tipo do arquivo não corresponde à extensão.", 415);
      }
    }

    if (uploadContext === "chat") {
      const MAX_CHAT_SIZE = 10 * 1024 * 1024;
      if (fileObj.size > MAX_CHAT_SIZE) {
        const sizeMb = (fileObj.size / (1024 * 1024)).toFixed(1);
        return errorResponse(
          `O arquivo selecionado possui ${sizeMb} MB. O limite máximo permitido para envio no chat é de 10 MB por arquivo.`,
          400
        );
      }
    }

    const MAX_SIZE = 100 * 1024 * 1024;
    if (fileObj.size > MAX_SIZE) {
      return errorResponse("Arquivo excede o tamanho máximo permitido de 100MB.", 400);
    }

    const head = new Uint8Array(await fileObj.slice(0, 16).arrayBuffer());
    if (!magicBytesMatch(extFromName, head)) {
      return errorResponse("O conteúdo do arquivo não corresponde ao tipo informado.", 415);
    }

    const folder = allowed.kind === "audio" ? "audio" : allowed.kind === "video" ? "videos" : allowed.kind === "image" ? "images" : "documents";
    const uniqueId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const key = `${folder}/${uniqueId}.${extFromName}`;

    await bucket.put(key, fileObj.stream(), {
      httpMetadata: {
        contentType: allowed.mime,
      },
      customMetadata: {
        originalName: fileObj.name.slice(0, 200),
        size: String(fileObj.size),
        uploadedBy: String(user.id),
        uploaderName: user.username,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Miniatura (foto) ou capa (vídeo) opcional: JPEG pequeno gerado no navegador, guardado ao lado do arquivo
    const thumb = formData.get("thumbnail");
    if ((allowed.kind === "video" || (allowed.kind === "image" && ["jpg", "jpeg", "png", "webp"].includes(extFromName))) && thumb && typeof thumb !== "string") {
      const thumbFile = thumb as File;
      if (thumbFile.size > 0 && thumbFile.size <= 300 * 1024) {
        const thumbHead = new Uint8Array(await thumbFile.slice(0, 3).arrayBuffer());
        if (startsWith(thumbHead, [0xff, 0xd8, 0xff])) {
          try {
            await bucket.put(`${folder}/${uniqueId}_t.jpg`, thumbFile.stream(), {
              httpMetadata: { contentType: "image/jpeg" },
              customMetadata: { uploadedBy: String(user.id), thumbnailOf: key },
            });
          } catch (err) {
            console.error("Miniatura não salva:", err);
          }
        }
      }
    }

    const origin = new URL(request.url).origin;

    return jsonResponse({
      url: `${origin}/api/media/${key}`,
      relative_url: `/api/media/${key}`,
      key,
      media_type: allowed.kind,
      filename: fileObj.name,
      size: fileObj.size,
      content_type: allowed.mime,
    });
  } catch (err: unknown) {
    console.error("Erro no upload:", err);
    return errorResponse("Erro ao processar upload.", 500);
  }
};
