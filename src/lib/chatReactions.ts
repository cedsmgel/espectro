// Reações rápidas (mesma lista aceita pelo servidor)
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export interface MessageReaction {
  user_id: number;
  emoji: string;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  mine: boolean;
}

// Agrupa por emoji (conversa 1:1: no máximo duas reações por mensagem)
export function groupReactions(reactions: MessageReaction[] | undefined, myId: number | undefined): ReactionGroup[] {
  const groups = new Map<string, ReactionGroup>();
  for (const reaction of reactions || []) {
    const group = groups.get(reaction.emoji) || { emoji: reaction.emoji, count: 0, mine: false };
    group.count += 1;
    if (reaction.user_id === myId) group.mine = true;
    groups.set(reaction.emoji, group);
  }
  return [...groups.values()];
}
