import { useCallback, useRef, useState } from 'react';

// Gravação de mensagem de voz pelo navegador (MediaRecorder)
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setSeconds(0);
  }, []);

  // Retorna null se começou; senão, a mensagem de erro a mostrar
  const start = useCallback(async (): Promise<string | null> => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return 'Seu navegador não permite gravar áudio.';
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      return null;
    } catch {
      cleanup();
      return 'Permita o uso do microfone para gravar.';
    }
  }, [cleanup]);

  // Para e devolve o áudio gravado
  const stop = useCallback((): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return Promise.resolve(null);
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        cleanup();
        resolve(blob.size > 0 ? blob : null);
      };
      recorder.stop();
    });
  }, [cleanup]);

  // Para e descarta
  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) {
      cleanup();
      return;
    }
    recorder.onstop = () => cleanup();
    recorder.stop();
  }, [cleanup]);

  return { recording, seconds, start, stop, cancel };
}
