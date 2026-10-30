import React from 'react';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Falha na conexão com o Espectro',
  message = 'Não foi possível carregar os dados agora. Pode ser uma oscilação na rede ou no servidor.',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`relative overflow-hidden bg-surface-container-lowest rounded-3xl p-8 sm:p-12 text-center border border-error-container/40 shadow-sm flex flex-col items-center justify-center transition-all ${className}`}
    >
      {/* Background glow in soft amber/rose */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-error/10 rounded-full blur-3xl pointer-events-none" />

      {/* Central icon container */}
      <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-error-container/20 border border-error/30 flex items-center justify-center text-error shadow-inner mb-4">
        <span className="material-symbols-outlined text-[36px] sm:text-[42px] select-none">
          cloud_off
        </span>
      </div>

      {/* Title */}
      <h3 className="relative z-10 font-bold text-lg sm:text-xl text-on-surface tracking-tight">
        {title}
      </h3>

      {/* Description */}
      <p className="relative z-10 text-xs sm:text-sm text-on-surface-variant max-w-md mx-auto mt-2 leading-relaxed">
        {message}
      </p>

      {/* Retry Button */}
      {onRetry && (
        <div className="relative z-10 mt-6">
          <button
            type="button"
            onClick={onRetry}
            className="px-6 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs sm:text-sm hover:bg-primary shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            <span>Tentar Novamente</span>
          </button>
        </div>
      )}
    </div>
  );
};
