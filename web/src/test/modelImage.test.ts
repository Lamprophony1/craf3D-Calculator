import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_MODEL_IMAGE_BYTES, prepareModelImage } from '../utils/modelImage';

describe('prepareModelImage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rechaza archivos que superan 8 MB', async () => {
    const file = new File([new Uint8Array(MAX_MODEL_IMAGE_BYTES + 1)], 'captura.png', { type: 'image/png' });
    await expect(prepareModelImage(file)).rejects.toThrow('La imagen del modelo no puede superar 8 MB.');
  });

  it('rechaza un archivo no compatible antes de incorporarlo', async () => {
    const file = new File(['texto'], 'captura.txt', { type: 'text/plain' });
    await expect(prepareModelImage(file)).rejects.toThrow('No pudimos procesar esa imagen. Probá con una captura PNG o JPG.');
  });

  it('acepta una extensión móvil conocida sin MIME y limita el lado mayor', async () => {
    let decodedSource = '';
    class DecodableImage extends EventTarget {
      naturalWidth = 4_000;
      naturalHeight = 2_000;
      set src(value: string) { decodedSource = value; queueMicrotask(() => this.dispatchEvent(new Event('load'))); }
    }
    vi.stubGlobal('Image', DecodableImage);
    const context = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([10, 20, 30, 255]) }))
    };
    let renderedCanvas: HTMLCanvasElement | null = null;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      renderedCanvas = this;
      return context as unknown as CanvasRenderingContext2D;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,normalized');

    await expect(prepareModelImage(new File(['photo'], 'modelo.heic'))).resolves.toBe('data:image/jpeg;base64,normalized');
    expect(decodedSource).toMatch(/^data:image\/heic;base64,/);
    expect(renderedCanvas).toMatchObject({ width: 2_048, height: 1_024 });
    expect(context.drawImage).toHaveBeenCalledOnce();
  });

  it('rechaza una imagen declarada que el navegador no puede decodificar', async () => {
    class BrokenImage extends EventTarget {
      naturalWidth = 0;
      naturalHeight = 0;
      set src(_value: string) { queueMicrotask(() => this.dispatchEvent(new Event('error'))); }
    }
    vi.stubGlobal('Image', BrokenImage);
    await expect(prepareModelImage(new File(['broken'], 'captura.png', { type: 'image/png' })))
      .rejects.toThrow('No pudimos procesar esa imagen. Probá con una captura PNG o JPG.');
  });
});
