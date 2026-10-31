import type React from 'react';

/**
 * Personalização visual dos Scraps ("recados").
 * O estilo é serializado como um marcador no início do conteúdo do post,
 * evitando migrações no D1: [[scrap:{"f":"hand","s":"lg","c":"#1f2937","p":"yellow"}]]
 */

export type ScrapFont = 'hand' | 'marker' | 'typewriter' | 'serif';
export type ScrapSize = 'md' | 'lg' | 'xl';
export type ScrapPaper = 'yellow' | 'pink' | 'blue' | 'green' | 'white';

export interface ScrapStyle {
  f: ScrapFont;
  s: ScrapSize;
  c: string;
  p: ScrapPaper;
}

export const DEFAULT_SCRAP_STYLE: ScrapStyle = { f: 'hand', s: 'lg', c: '#1f2937', p: 'yellow' };

export const SCRAP_FONTS: Record<ScrapFont, { label: string; family: string }> = {
  hand: { label: 'Caligrafia', family: "'Caveat', cursive" },
  marker: { label: 'Canetinha', family: "'Permanent Marker', cursive" },
  typewriter: { label: 'Máquina', family: "'Special Elite', monospace" },
  serif: { label: 'Clássica', family: "Georgia, 'Times New Roman', serif" },
};

export const SCRAP_SIZES: Record<ScrapSize, { label: string; px: number }> = {
  md: { label: 'A', px: 18 },
  lg: { label: 'A+', px: 24 },
  xl: { label: 'A++', px: 32 },
};

export const SCRAP_PAPERS: Record<ScrapPaper, { label: string; bg: string; line: string }> = {
  yellow: { label: 'Post-it', bg: '#fef3a0', line: 'rgba(180,150,40,0.25)' },
  pink: { label: 'Rosa', bg: '#fbcfe8', line: 'rgba(190,60,120,0.2)' },
  blue: { label: 'Azul', bg: '#bfdbfe', line: 'rgba(40,90,180,0.2)' },
  green: { label: 'Oliva', bg: '#d9e6b8', line: 'rgba(107,142,35,0.3)' },
  white: { label: 'Caderno', bg: '#fafaf7', line: 'rgba(37,99,235,0.18)' },
};

export const SCRAP_INK_COLORS = ['#1f2937', '#1E3A8A', '#6B8E23', '#b91c1c', '#7c3aed'];

const MARKER_RE = /^\[\[scrap:(\{.*?\})\]\]\n?/;

export function encodeScrap(style: ScrapStyle, body: string): string {
  return `[[scrap:${JSON.stringify(style)}]]\n${body}`;
}

export function parseScrap(content: string): { style: ScrapStyle | null; body: string } {
  const m = content.match(MARKER_RE);
  if (!m) return { style: null, body: content };
  try {
    const parsed = JSON.parse(m[1]);
    return { style: { ...DEFAULT_SCRAP_STYLE, ...parsed }, body: content.slice(m[0].length) };
  } catch {
    return { style: null, body: content };
  }
}

/** Estilo inline do "papel" do recado (pautado, levemente inclinado). */
export function scrapPaperStyle(style: ScrapStyle): React.CSSProperties {
  const paper = SCRAP_PAPERS[style.p] || SCRAP_PAPERS.yellow;
  const size = SCRAP_SIZES[style.s] || SCRAP_SIZES.lg;
  const lineH = Math.round(size.px * 1.45);
  return {
    backgroundColor: paper.bg,
    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${lineH - 1}px, ${paper.line} ${lineH - 1}px, ${paper.line} ${lineH}px)`,
    backgroundPosition: '0 12px',
    color: style.c,
    fontFamily: (SCRAP_FONTS[style.f] || SCRAP_FONTS.hand).family,
    fontSize: `${size.px}px`,
    lineHeight: `${lineH}px`,
  };
}
