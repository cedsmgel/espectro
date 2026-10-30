import React from "react";
import { Community } from "../lib/api";

interface CommunityCardProps {
  community: Community;
  onJoin?: (id: number) => void;
  isJoining?: boolean;
}

export const CommunityCard: React.FC<CommunityCardProps> = ({
  community,
  onJoin,
  isJoining = false,
}) => {
  return (
    <div className="bg-white border border-[#bfd4f2] rounded-lg p-4 shadow-sm flex flex-col justify-between hover:border-[#85a9df] transition-all">
      <div>
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-12 h-12 rounded bg-[#e8eef7] border border-[#a2bfeb] flex items-center justify-center font-bold text-[#3b5998] text-xl shadow-inner">
            {community.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[#2d4373] text-base truncate hover:underline cursor-pointer">
              {community.name}
            </h3>
            <p className="text-xs text-gray-500">
              Criada por <span className="font-semibold text-gray-700">{community.owner_name}</span>
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-600 line-clamp-3 my-2 leading-relaxed min-h-[3rem]">
          {community.description || "Nenhuma descrição informada para esta comunidade."}
        </p>
      </div>

      <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-2">
        <span className="text-xs font-semibold text-[#3b5998] bg-[#e8eef7] px-2.5 py-1 rounded-full border border-[#c9daf3]">
          👥 {community.members_count || 1} {community.members_count === 1 ? "membro" : "membros"}
        </span>

        {onJoin && (
          <button
            onClick={() => onJoin(community.id)}
            disabled={isJoining}
            className="text-xs font-bold bg-[#3b5998] hover:bg-[#2d4373] text-white px-3 py-1.5 rounded transition shadow-sm disabled:opacity-50"
          >
            {isJoining ? "Entrando..." : "+ Entrar"}
          </button>
        )}
      </div>
    </div>
  );
};
