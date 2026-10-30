import React from "react";

// Estrutura de pasta reservada para o módulo de Notícias e Avisos
export const NewsPlaceholder: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto my-12 p-8 bg-white border border-[#bfd4f2] rounded-lg text-center shadow-sm">
      <h2 className="text-xl font-bold text-[#2d4373] mb-2">📰 Central de Notícias</h2>
      <p className="text-sm text-gray-600">
        Módulo em preparação para novidades, comunicados e tendências da rede.
      </p>
    </div>
  );
};
