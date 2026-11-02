import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { categorias } from './categorias';

const slugs = categorias.map((c) => c.slug) as [string, ...string[]];

// Cada artigo é um arquivo Markdown em src/content/artigos/<categoria>/<slug>.md
const artigos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/artigos' }),
  schema: z.object({
    titulo: z.string(),
    categoria: z.enum(slugs),
    resumo: z.string().max(200),
    atualizado: z.coerce.date(),
    ordem: z.number().default(100),
  }),
});

export const collections = { artigos };
