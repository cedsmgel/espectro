// Campos do perfil e suas regras. O cliente tem uma cópia dos rótulos em src/lib/profileFields.ts.

export const VISIBILITIES = ["public", "friends", "private"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const RELATIONSHIP_OPTIONS = ["solteiro", "namorando", "casado", "uniao_estavel", "complicado", "prefiro_nao_dizer"];

const TEXT_LIMITS: Record<string, number> = {
  pronouns: 30,
  location: 60,
  languages: 100,
  occupation: 60,
  company: 60,
  education: 100,
};

export const PROFILE_FIELD_KEYS = [
  "pronouns",
  "location",
  "birthday",
  "relationship",
  "languages",
  "interests",
  "occupation",
  "company",
  "education",
  "links",
];

const MAX_LINKS = 5;
const MAX_TAGS = 10;

// Devolve o valor limpo para guardar, "" para apagar o campo ou { error }
export function normalizeField(field: string, raw: unknown): string | { error: string } {
  if (raw === null || raw === undefined) return "";
  if (field in TEXT_LIMITS) {
    const text = String(raw).trim().replace(/\s+/g, " ");
    return text.length > TEXT_LIMITS[field] ? { error: `Máximo de ${TEXT_LIMITS[field]} caracteres em ${field}.` } : text;
  }

  switch (field) {
    case "birthday": {
      const text = String(raw).trim();
      if (!text) return "";
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
      if (!match) return { error: "Data de aniversário inválida." };
      const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
      const date = new Date(Date.UTC(year, month - 1, day));
      const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
      if (!valid || year < 1900 || date.getTime() > Date.now()) return { error: "Data de aniversário inválida." };
      return text;
    }
    case "relationship": {
      const text = String(raw).trim();
      if (!text) return "";
      return RELATIONSHIP_OPTIONS.includes(text) ? text : { error: "Opção de relacionamento inválida." };
    }
    case "interests": {
      const list = (Array.isArray(raw) ? raw : String(raw).split(","))
        .map((tag) => String(tag).trim().replace(/\s+/g, " "))
        .filter(Boolean);
      const unique = [...new Set(list.map((tag) => tag.toLowerCase()))];
      if (unique.length > MAX_TAGS) return { error: `Use até ${MAX_TAGS} interesses.` };
      if (list.some((tag) => tag.length > 24)) return { error: "Cada interesse pode ter até 24 caracteres." };
      return unique.join(",");
    }
    case "links": {
      const list = Array.isArray(raw) ? raw : [];
      const links: { label: string; url: string }[] = [];
      for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const label = String((item as any).label ?? "").trim();
        const url = String((item as any).url ?? "").trim();
        if (!label && !url) continue;
        if (!label || label.length > 30) return { error: "Cada link precisa de um título de até 30 caracteres." };
        if (url.length > 200 || !/^https:\/\/[^\s<>"']+$/.test(url)) return { error: "Os links precisam começar com https://." };
        links.push({ label, url });
      }
      if (links.length > MAX_LINKS) return { error: `Use até ${MAX_LINKS} links.` };
      return links.length ? JSON.stringify(links) : "";
    }
    default:
      return { error: "Campo desconhecido." };
  }
}
