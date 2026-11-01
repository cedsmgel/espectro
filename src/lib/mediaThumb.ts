// Miniaturas das fotos enviadas: o envio guarda, ao lado de `images/<id>.<ext>`, uma cópia pequena em `images/<id>_t.jpg`

const THUMB_SIDE = 480;
const THUMB_QUALITY = 0.75;
// Fotos que já são leves não precisam de miniatura
const SKIP_BELOW_BYTES = 60 * 1024;

const IMAGE_URL = /^(.*\/api\/media\/images\/[\w-]+?)\.(?:jpe?g|png|webp)(\?.*)?$/i;

// Endereço da miniatura de uma foto do site; devolve o próprio endereço quando não há miniatura (GIF, link externo)
export function thumbUrl(url: string | null | undefined): string {
  if (!url) return '';
  const match = IMAGE_URL.exec(url);
  if (!match || match[1].endsWith('_t')) return url;
  return `${match[1]}_t.jpg`;
}

// Gera a miniatura no navegador; null quando não vale a pena ou o navegador não consegue
export async function makeThumbnail(file: File): Promise<File | null> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < SKIP_BELOW_BYTES) return null;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, THUMB_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // Fundo branco: PNG com transparência não vira preto ao virar JPEG
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', THUMB_QUALITY));
    if (!blob || blob.size >= file.size) return null;
    return new File([blob], 'thumb.jpg', { type: 'image/jpeg' });
  } catch {
    return null;
  }
}
