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
    <div className="rounded-xl p-5 bg-surface-container-lowest/80 backdrop-blur-xl border border-outline-variant/30 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-surface-container-low border border-outline-variant/30 text-primary flex items-center justify-center font-bold text-base shadow-sm group-hover:bg-primary group-hover:text-white transition-colors">
              {community.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-on-surface truncate group-hover:text-primary transition-colors">
                #{community.name}
              </h3>
              <p className="text-[11px] text-outline">
                Por <span className="text-on-surface-variant font-medium">{community.owner_name}</span>
              </p>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded-full bg-secondary-container/50 text-secondary text-[11px] font-semibold shrink-0">
            {community.members_count || 1} {community.members_count === 1 ? "membro" : "membros"}
          </span>
        </div>

        <p className="text-xs text-on-surface-variant line-clamp-3 my-2 leading-relaxed min-h-[2.75rem]">
          {community.description || "Comunidade dedicada a discussões, ideias e trocas no Espectro."}
        </p>
      </div>

      <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-between mt-2">
        <span className="text-[11px] text-outline flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">calendar_today</span>
          Ativa
        </span>

        {onJoin && (
          <button
            onClick={() => onJoin(community.id)}
            disabled={isJoining}
            className="text-xs font-semibold bg-primary-container hover:bg-primary text-on-primary px-3 py-1.5 rounded-lg transition shadow-sm disabled:opacity-50 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">person_add</span>
            <span>{isJoining ? "Entrando..." : "Entrar"}</span>
          </button>
        )}
      </div>
    </div>
  );
};
