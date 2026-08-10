import { useCallback, useEffect, useState, type RefObject } from 'react';
import { toPng } from 'html-to-image';

export type ClientQuoteExportStatus = 'idle' | 'ready' | 'exporting' | 'sharing' | 'downloading' | 'error';

async function waitForAssets(node: HTMLElement) {
  if (document.fonts) await document.fonts.ready;
  const images = Array.from(node.querySelectorAll('img'));
  await Promise.all(images.map(image => image.complete
    ? Promise.resolve()
    : new Promise<void>(resolve => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
      })));
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, encoded] = dataUrl.split(',', 2);
  const mime = metadata.match(/^data:([^;]+);base64$/)?.[1] ?? 'image/png';
  const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export function useClientQuoteImageExport(
  cardRef: RefObject<HTMLElement | null>,
  filename: string,
  active: boolean
) {
  const [status, setStatus] = useState<ClientQuoteExportStatus>('idle');
  const [feedback, setFeedback] = useState<{ type: 'status' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setStatus(active ? 'ready' : 'idle');
    setFeedback(null);
  }, [active]);

  const createFile = useCallback(async () => {
    const card = cardRef.current;
    if (!card) throw new Error('La vista previa todavía no está lista.');
    await waitForAssets(card);
    const dataUrl = await toPng(card, {
      width: 1080,
      height: 1350,
      pixelRatio: 1,
      cacheBust: true,
      backgroundColor: '#F8E9D1'
    });
    const blob = dataUrlToBlob(dataUrl);
    return new File([blob], filename, { type: 'image/png' });
  }, [cardRef, filename]);

  const download = useCallback(async () => {
    setStatus('exporting');
    setFeedback(null);
    try {
      const file = await createFile();
      setStatus('downloading');
      downloadBlob(file, filename);
      setStatus('ready');
      setFeedback({ type: 'status', message: 'Imagen descargada. Ya podés enviarla por tu canal habitual.' });
    } catch (reason) {
      setStatus('error');
      setFeedback({ type: 'error', message: reason instanceof Error ? reason.message : 'No pudimos generar la imagen.' });
    }
  }, [createFile, filename]);

  const share = useCallback(async () => {
    setStatus('exporting');
    setFeedback(null);
    try {
      const file = await createFile();
      const payload: ShareData = { files: [file], title: 'Cotización de impresión 3D' };
      const canShareFile = typeof navigator.share === 'function'
        && typeof navigator.canShare === 'function'
        && navigator.canShare(payload);
      if (canShareFile) {
        setStatus('sharing');
        await navigator.share(payload);
        setStatus('ready');
        setFeedback({ type: 'status', message: 'Cotización compartida.' });
        return;
      }
      setStatus('downloading');
      downloadBlob(file, filename);
      setStatus('ready');
      setFeedback({ type: 'status', message: 'Este dispositivo no permite compartir archivos. Descargamos el PNG para que puedas enviarlo.' });
    } catch (reason) {
      if ((reason as { name?: string })?.name === 'AbortError') {
        setStatus('ready');
        return;
      }
      setStatus('error');
      setFeedback({ type: 'error', message: 'No pudimos compartir la imagen. Probá descargarla.' });
    }
  }, [createFile, filename]);

  return { status, feedback, share, download };
}
