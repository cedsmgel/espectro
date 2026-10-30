import React from "react";

// Estrutura de pasta reservada para o módulo de Chat / Mensagens instantâneas
export const ChatPlaceholder: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto my-12 p-8 bg-white border border-[#bfd4f2] rounded-lg text-center shadow-sm">
      <h2 className="text-xl font-bold text-[#2d4373] mb-2">💬 Chat do Espectro</h2>
      <p className="text-sm text-gray-600">
        Módulo em preparação para troca de mensagens instantâneas entre amigos.
      </p>
    </div>
  );
};
