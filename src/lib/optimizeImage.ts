import Compressor from 'compressorjs';

// Lado maior e qualidade das fotos enviadas (o chat mostra ~240 px; o feed, no máximo ~700 px)
const MAX_SIDE = 1600;
const QUALITY = 0.82;
// Abaixo disso não vale recomprimir
const SKIP_BELOW_BYTES = 200 * 1024;
// PNG pesado (screenshot, foto salva como PNG) vira JPEG; PNG leve mantém a transparência
const PNG_TO_JPEG_ABOVE_BYTES = 600 * 1024;

const COMPRESSIBLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

const EXT_BY_TYPE: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Reduz a foto antes do envio. GIF, imagens pequenas e qualquer falha devolvem o arquivo original.
// Devolve também o nome com a extensão certa, porque o servidor confere o tipo pela extensão.
export function optimizeImage(file: File): Promise<File> {
  if (!COMPRESSIBLE.has(file.type) || file.size < SKIP_BELOW_BYTES) return Promise.resolve(file);

  return new Promise((resolve) => {
    new Compressor(file, {
      quality: QUALITY,
      maxWidth: MAX_SIDE,
      maxHeight: MAX_SIDE,
      mimeType: 'auto',
      convertTypes: ['image/png'],
      convertSize: PNG_TO_JPEG_ABOVE_BYTES,
      success(result) {
        // Nada ganho: fica com o original
        if (result.size >= file.size) {
          resolve(file);
          return;
        }
        const type = result.type || file.type;
        const ext = EXT_BY_TYPE[type] || 'jpg';
        const base = file.name.replace(/\.[^/.]+$/, '') || 'foto';
        resolve(new File([result], `${base}.${ext}`, { type, lastModified: Date.now() }));
      },
      error() {
        resolve(file);
      },
    });
  });
}
