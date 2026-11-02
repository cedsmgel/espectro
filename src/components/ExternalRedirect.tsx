import React, { useEffect } from 'react';

// Leva a pessoa a um endereço de outro site (ex.: Termos e Privacidade, que moram na Central de Ajuda)
export const ExternalRedirect: React.FC<{ to: string; label: string }> = ({ to, label }) => {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return (
    <div className="min-h-dvh flex items-center justify-center px-4 text-center text-sm text-on-surface-variant">
      <p>
        Abrindo {label}... Se não abrir, <a href={to} className="underline text-on-surface">toque aqui</a>.
      </p>
    </div>
  );
};
