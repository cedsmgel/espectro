import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Area, getCroppedImg, compressImage } from '../lib/cropImage';

interface ImageCropperModalProps {
  imageSrc: string;
  originalFileName?: string;
  onConfirmCrop: (croppedFile: File, previewUrl: string) => void;
  onCancel: () => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  imageSrc,
  originalFileName = 'image.jpg',
  onConfirmCrop,
  onCancel,
}) => {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number>(4 / 5); // Padrão Espectro (Retrato 4:5 ou Quadrado 1:1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleApplyCrop = async () => {
    if (!croppedAreaPixels) return;

    setProcessing(true);
    try {
      // 1. Recorta a imagem no Canvas nas dimensões exatas selecionadas
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels, originalFileName);

      // 2. Comprime via CompressorJS para economizar espaço e tráfego R2
      const compressedFile = await compressImage(croppedFile, 0.8, 2048, 2048);

      // 3. Cria URL temporária para miniatura imediata
      const previewUrl = URL.createObjectURL(compressedFile);

      onConfirmCrop(compressedFile, previewUrl);
    } catch (err) {
      console.error('Erro ao recortar imagem:', err);
      alert('Erro ao processar o recorte da imagem. Tente novamente.');
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-xl max-h-[92dvh] bg-surface-container-lowest dark:bg-[#121212] rounded-3xl overflow-hidden border border-outline-variant/30 shadow-2xl flex flex-col animate-in zoom-in-95 my-auto">
        {/* Topo do Modal */}
        <div className="px-5 py-3.5 border-b border-outline-variant/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">crop</span>
            <h3 className="font-bold text-sm text-on-surface">Ajustar e Recortar Imagem</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Área do Cropper com react-easy-crop */}
        <div className="relative w-full h-[40dvh] sm:h-[380px] min-h-[240px] bg-black shrink-0">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            classes={{
              containerClassName: 'relative w-full h-full',
              cropAreaClassName: 'rounded-lg border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]',
            }}
          />
        </div>

        {/* Controles de Proporção e Zoom */}
        <div className="p-4 sm:p-5 flex flex-col gap-3.5 bg-surface-container-low dark:bg-black/40 border-t border-outline-variant/15 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Proporções Rápidas */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-on-surface-variant">Proporção:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAspect(4 / 5)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  aspect === 4 / 5
                    ? 'bg-primary-container text-on-primary shadow-xs'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                4:5 (Retrato)
              </button>

              <button
                type="button"
                onClick={() => setAspect(1 / 1)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  aspect === 1 / 1
                    ? 'bg-primary-container text-on-primary shadow-xs'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                1:1 (Quadrado)
              </button>

              <button
                type="button"
                onClick={() => setAspect(16 / 9)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  aspect === 16 / 9
                    ? 'bg-primary-container text-on-primary shadow-xs'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                16:9 (Paisagem)
              </button>
            </div>
          </div>

          {/* Slider de Zoom */}
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">zoom_out</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-primary h-1.5 bg-surface-container-high rounded-lg cursor-pointer"
            />
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">zoom_in</span>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant/15">
            <button
              type="button"
              onClick={onCancel}
              disabled={processing}
              className="px-4 py-2 rounded-full bg-surface-container text-on-surface hover:bg-surface-container-high text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleApplyCrop}
              disabled={processing}
              className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {processing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Aplicar Recorte</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
