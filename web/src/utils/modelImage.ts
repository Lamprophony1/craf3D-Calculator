export const MAX_MODEL_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_MODEL_IMAGE_SIDE = 2_048;

const KNOWN_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif']);
const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif'
};
const PROCESSING_ERROR = 'No pudimos procesar esa imagen. Probá con una captura PNG o JPG.';

export class ModelImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelImageError';
  }
}

function extensionOf(filename: string) {
  return filename.split('.').pop()?.toLocaleLowerCase('en') ?? '';
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        const inferredMime = IMAGE_MIME_BY_EXTENSION[extensionOf(file.name)];
        resolve(!file.type && inferredMime
          ? reader.result.replace(/^data:[^;,]*/, `data:${inferredMime}`)
          : reader.result);
      }
      else reject(new ModelImageError(PROCESSING_ERROR));
    }, { once: true });
    reader.addEventListener('error', () => reject(new ModelImageError(PROCESSING_ERROR)), { once: true });
    reader.readAsDataURL(file);
  });
}

function decodeImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve(image);
      else reject(new ModelImageError(PROCESSING_ERROR));
    }, { once: true });
    image.addEventListener('error', () => reject(new ModelImageError(PROCESSING_ERROR)), { once: true });
    image.src = source;
  });
}

function hasTransparency(context: CanvasRenderingContext2D, width: number, height: number) {
  try {
    const pixels = context.getImageData(0, 0, width, height).data;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 255) return true;
    }
    return false;
  } catch {
    return true;
  }
}

export async function prepareModelImage(file: File): Promise<string> {
  if (file.size > MAX_MODEL_IMAGE_BYTES)
    throw new ModelImageError('La imagen del modelo no puede superar 8 MB.');

  const hasImageMime = file.type.toLocaleLowerCase('en').startsWith('image/');
  const hasKnownExtension = KNOWN_IMAGE_EXTENSIONS.has(extensionOf(file.name));
  if ((!hasImageMime && file.type !== '') || (!hasImageMime && !hasKnownExtension))
    throw new ModelImageError(PROCESSING_ERROR);

  try {
    const source = await readAsDataUrl(file);
    const image = await decodeImage(source);
    const scale = Math.min(1, MAX_MODEL_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new ModelImageError(PROCESSING_ERROR);
    context.drawImage(image, 0, 0, width, height);

    const canContainTransparency = /png|webp/i.test(file.type) || /\.(png|webp)$/i.test(file.name);
    const outputType = canContainTransparency && hasTransparency(context, width, height)
      ? 'image/png'
      : 'image/jpeg';
    return canvas.toDataURL(outputType, outputType === 'image/jpeg' ? .9 : undefined);
  } catch (reason) {
    if (reason instanceof ModelImageError) throw reason;
    throw new ModelImageError(PROCESSING_ERROR);
  }
}
