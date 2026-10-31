import Compressor from 'compressorjs';

export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Recorta uma imagem a partir das coordenadas em pixels de react-easy-crop
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  originalFileName: string = 'image.jpg'
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Não foi possível inicializar o contexto 2D do Canvas');
  }

  canvas.width = Math.max(1, Math.round(pixelCrop.width));
  canvas.height = Math.max(1, Math.round(pixelCrop.height));

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Falha ao processar o recorte da imagem no Canvas'));
          return;
        }
        const safeName = originalFileName.replace(/\.[^/.]+$/, '') + '.jpg';
        const file = new File([blob], safeName, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        resolve(file);
      },
      'image/jpeg',
      0.95
    );
  });
}

/**
 * Comprime uma imagem usando CompressorJS para reduzir tamanho e poupar R2
 */
export function compressImage(
  file: File | Blob,
  quality: number = 0.8,
  maxWidth: number = 2048,
  maxHeight: number = 2048
): Promise<File> {
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality,
      maxWidth,
      maxHeight,
      mimeType: 'image/jpeg',
      convertTypes: ['image/png', 'image/webp'],
      convertSize: 1500000, // Converte PNGs pesados para JPEG
      success(result) {
        const originalName = file instanceof File ? file.name : 'image.jpg';
        const safeName = originalName.replace(/\.[^/.]+$/, '') + '.jpg';
        const compressedFile = new File([result], safeName, {
          type: result.type || 'image/jpeg',
          lastModified: Date.now(),
        });
        resolve(compressedFile);
      },
      error(err) {
        // Se a compressão falhar (ex: SVG ou formato exótico), fallback para o arquivo original se for File
        if (file instanceof File) {
          console.warn('Compressão falhou, prosseguindo com arquivo original:', err);
          resolve(file);
        } else {
          reject(err);
        }
      },
    });
  });
}
