export type Visibility = 'public' | 'friends' | 'private';

export const VISIBILITY_OPTIONS: { value: Visibility; label: string; icon: string }[] = [
  { value: 'public', label: 'Público', icon: 'public' },
  { value: 'friends', label: 'Amigos', icon: 'group' },
  { value: 'private', label: 'Só eu', icon: 'lock' },
];

export const RELATIONSHIP_LABELS: Record<string, string> = {
  solteiro: 'Solteiro(a)',
  namorando: 'Namorando',
  casado: 'Casado(a)',
  uniao_estavel: 'União estável',
  complicado: 'Complicado',
  prefiro_nao_dizer: 'Prefiro não dizer',
};

export type FieldKind = 'text' | 'date' | 'select' | 'tags' | 'links';

export interface ProfileFieldDef {
  key: string;
  label: string;
  icon: string;
  kind: FieldKind;
  maxLength?: number;
  hint?: string;
  group: 'sobre' | 'trabalho' | 'links';
}

export const PROFILE_FIELDS: ProfileFieldDef[] = [
  { key: 'pronouns', label: 'Pronomes', icon: 'badge', kind: 'text', maxLength: 30, group: 'sobre' },
  { key: 'location', label: 'Cidade ou região', icon: 'location_on', kind: 'text', maxLength: 60, group: 'sobre' },
  { key: 'birthday', label: 'Aniversário', icon: 'cake', kind: 'date', hint: 'Só o dia e o mês aparecem; o ano nunca é exibido.', group: 'sobre' },
  { key: 'relationship', label: 'Relacionamento', icon: 'favorite', kind: 'select', group: 'sobre' },
  { key: 'languages', label: 'Idiomas', icon: 'translate', kind: 'text', maxLength: 100, group: 'sobre' },
  { key: 'interests', label: 'Interesses', icon: 'interests', kind: 'tags', hint: 'Separe por vírgula. Até 10.', group: 'sobre' },
  { key: 'occupation', label: 'Ocupação', icon: 'work', kind: 'text', maxLength: 60, group: 'trabalho' },
  { key: 'company', label: 'Empresa ou instituição', icon: 'apartment', kind: 'text', maxLength: 60, group: 'trabalho' },
  { key: 'education', label: 'Formação', icon: 'school', kind: 'text', maxLength: 100, group: 'trabalho' },
  { key: 'links', label: 'Links', icon: 'link', kind: 'links', hint: 'Até 5, começando com https://.', group: 'links' },
];

export interface ProfileLink {
  label: string;
  url: string;
}

export function parseLinks(value: string | undefined): ProfileLink[] {
  if (!value) return [];
  try {
    const list = JSON.parse(value);
    return Array.isArray(list) ? list.filter((l) => l && typeof l.label === 'string' && typeof l.url === 'string') : [];
  } catch {
    return [];
  }
}

export function parseTags(value: string | undefined): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

// "1995-03-12" -> "12 de março" (o ano nunca aparece)
export function formatBirthday(value: string): string {
  const [, month, day] = value.split('-').map(Number);
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return month && day ? `${day} de ${months[month - 1]}` : value;
}

export function displayValue(key: string, value: string): string {
  if (key === 'birthday') return formatBirthday(value);
  if (key === 'relationship') return RELATIONSHIP_LABELS[value] || value;
  return value;
}
