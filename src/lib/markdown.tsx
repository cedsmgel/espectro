import React from 'react';
import { Link } from 'react-router-dom';
import { splitHashtags } from './hashtags';

/**
 * Renderiza formatação Markdown simples:
 * - **negrito**
 * - *itálico*
 * - [texto do link](https://...)
 * - `código inline`
 * Mantém sanitização 100% segura contra XSS utilizando nós do React.
 */
export function renderMarkdown(content: string): React.ReactNode {
  if (!content) return null;

  const lines = content.split('\n');

  return (
    <>
      {lines.map((line, lineIndex) => {
        if (line.trim() === '') {
          return <span key={lineIndex} className="block h-2" />;
        }

        // Expressão regular para links [texto](url), negrito **...**, itálico *...* e código inline `...`
        const regex = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
        const parts = line.split(regex);

        return (
          <span key={lineIndex} className="block leading-relaxed">
            {parts.map((part, partIndex) => {
              if (!part) return null;

              // 1. Link: [texto](https://...)
              const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
              if (linkMatch) {
                const [, text, url] = linkMatch;
                return (
                  <a
                    key={partIndex}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary-container font-semibold underline decoration-primary/40 hover:decoration-primary transition-colors inline-flex items-center gap-0.5 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>{text}</span>
                    <span className="material-symbols-outlined text-[12px] inline align-middle">
                      open_in_new
                    </span>
                  </a>
                );
              }

              // 2. Negrito: **texto**
              const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
              if (boldMatch) {
                return (
                  <strong key={partIndex} className="font-bold text-on-surface">
                    {boldMatch[1]}
                  </strong>
                );
              }

              // 3. Itálico: *texto*
              const italicMatch = part.match(/^\*([^*]+)\*$/);
              if (italicMatch) {
                return (
                  <em key={partIndex} className="italic text-on-surface/90">
                    {italicMatch[1]}
                  </em>
                );
              }

              // 4. Código inline: `código`
              const codeMatch = part.match(/^`([^`]+)`$/);
              if (codeMatch) {
                return (
                  <code
                    key={partIndex}
                    className="px-1.5 py-0.5 rounded-md bg-surface-container font-mono text-xs text-primary font-medium"
                  >
                    {codeMatch[1]}
                  </code>
                );
              }

              // 5. Hashtags: #palavra vira link para /tag/palavra
              return (
                <React.Fragment key={partIndex}>
                  {splitHashtags(part).map((piece, pieceIndex) =>
                    piece.tag ? (
                      <Link
                        key={pieceIndex}
                        to={`/tag/${encodeURIComponent(piece.tag)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold underline decoration-current/40 underline-offset-2 hover:decoration-current"
                      >
                        {piece.text}
                      </Link>
                    ) : (
                      <React.Fragment key={pieceIndex}>{piece.text}</React.Fragment>
                    )
                  )}
                </React.Fragment>
              );
            })}
          </span>
        );
      })}
    </>
  );
}
