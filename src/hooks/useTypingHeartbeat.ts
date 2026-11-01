import { useEffect, useRef } from 'react';

// Enquanto `active` (há texto na caixa de mensagem), reafirma "escrevendo" a cada 2 segundos;
// ao esvaziar a caixa, enviar ou sair da conversa, avisa que parou.
export function useTypingHeartbeat(active: boolean, send: (isTyping: boolean) => void): void {
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (!active) return;
    sendRef.current(true);
    const timer = window.setInterval(() => sendRef.current(true), 2000);
    return () => {
      window.clearInterval(timer);
      sendRef.current(false);
    };
  }, [active]);
}
