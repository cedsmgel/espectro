export interface ExportLine {
  created_at: string;
  sender: string;
  text: string;
}

const TYPE_LABEL: Record<string, string> = {
  image: '<foto>',
  video: '<vídeo>',
  gif: '<GIF>',
  sticker: '<figurinha>',
  audio: '<mensagem de voz>',
  file: '<documento>',
  location: '<localização>',
};

export function describeMessage(type: string | undefined, content: string, mediaUrl?: string | null, viewOnce?: boolean): string {
  if (viewOnce) return '<mídia temporária>';
  if (!type || type === 'text') return content;
  const label = TYPE_LABEL[type] || `<${type}>`;
  return [label, content && content !== 'GIF' && content !== 'Figurinha' ? content : '', mediaUrl || ''].filter(Boolean).join(' ');
}

// Baixa a conversa como arquivo .txt (uma linha por mensagem)
export function downloadConversation(title: string, lines: ExportLine[]) {
  const body = lines
    .map((l) => {
      const d = new Date(l.created_at);
      const stamp = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      return `[${stamp}] ${l.sender}: ${l.text}`;
    })
    .join('\n');
  const header = `Conversa do Espectro com ${title}\nExportada em ${new Date().toLocaleString('pt-BR')}\n\n`;
  const blob = new Blob([header + body + '\n'], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `conversa-${title.replace(/[^\w-]+/g, '_').slice(0, 40) || 'espectro'}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
