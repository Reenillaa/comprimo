import { crop, flatten, orient, type Codecs } from './codecs';
import { extractExif, insertApp1, jpegOrientation, rewriteExif } from './exif';
import { hasTransparency } from './metrics';
import { planResize } from './resize-math';
import { isSupportedKind, isTruncatedJpeg, sniff, unsupportedMessage } from './sniff';
import { autoCandidates, encodeFormat, type Encoded } from './strategies';
import {
  FORMAT_LABEL,
  MAX_PIXELS,
  MIME,
  ProcessingError,
  type ImageFormat,
  type ProcessOptions,
  type ProcessResult,
  type ProgressFn,
} from './types';

export interface PipelineHooks {
  onProgress?: ProgressFn;
  signal?: { cancelled: boolean };
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export async function processImage(
  input: Uint8Array,
  opts: ProcessOptions,
  codecs: Codecs,
  hooks: PipelineHooks = {},
): Promise<ProcessResult> {
  const t0 = now();
  const progress = hooks.onProgress ?? (() => {});
  const warnings: string[] = [];

  // 1. Validate by content
  const info = sniff(input);
  if (!isSupportedKind(info.kind)) throw new ProcessingError('unsupported', unsupportedMessage(info.kind));
  if (info.animated) {
    throw new ProcessingError(
      'animated',
      `Imagen ${FORMAT_LABEL[info.kind]} animada: la animación se perdería, así que no se procesa.`,
    );
  }
  if (info.width && info.height && info.width * info.height > MAX_PIXELS) {
    throw new ProcessingError(
      'too-large',
      `La imagen tiene ${Math.round((info.width * info.height) / 1e6)} MP. El máximo técnico en el navegador es ${MAX_PIXELS / 1e6} MP.`,
    );
  }

  if (info.kind === 'jpeg' && isTruncatedJpeg(input)) {
    throw new ProcessingError('corrupt', 'El JPEG está incompleto (archivo cortado): falta el final de la imagen.');
  }

  // 2. Decode
  progress(0.02, 'Decodificando');
  let img: ImageData;
  let oriented: boolean;
  try {
    ({ image: img, oriented } = await codecs.decode(info.kind, input.slice().buffer));
  } catch {
    throw new ProcessingError('corrupt', 'No se pudo leer la imagen: el archivo está dañado o incompleto.');
  }
  if (!img || img.width < 1 || img.height < 1) throw new ProcessingError('corrupt', 'La imagen no contiene píxeles válidos.');
  // Apply the EXIF rotation unless the decoder already did, so every environment agrees.
  if (info.kind === 'jpeg' && !oriented) img = orient(img, jpegOrientation(input));
  if (img.width * img.height > MAX_PIXELS) {
    throw new ProcessingError('too-large', `La imagen supera el máximo técnico de ${MAX_PIXELS / 1e6} MP.`);
  }
  progress(0.1, 'Decodificada');

  // 3. Resize
  let plan;
  try {
    plan = planResize(img.width, img.height, opts.resize);
  } catch (e) {
    throw new ProcessingError('invalid-options', (e as Error).message);
  }
  if (plan) {
    progress(0.12, 'Redimensionando');
    img = await codecs.resize(img, plan.scaleWidth, plan.scaleHeight);
    if (plan.crop) img = crop(img, plan.crop.x, plan.crop.y, plan.crop.width, plan.crop.height);
  }
  const resized = plan !== null;

  // 4. Output format
  const hasAlpha = hasTransparency(img);
  const candidates: ImageFormat[] =
    opts.output === 'same' ? [info.kind] : opts.output === 'auto' ? autoCandidates(hasAlpha) : [opts.output];

  // 5. Encode
  const results: Encoded[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const format = candidates[i];
    const label = candidates.length > 1 ? `Probando ${FORMAT_LABEL[format]}` : `Optimizando ${FORMAT_LABEL[format]}`;
    let src = img;
    if (format === 'jpeg' && hasAlpha) {
      src = flatten(img, opts.background);
      warnings.push(`JPEG no admite transparencia: se ha rellenado con el color ${opts.background}.`);
    }
    const base = 0.15 + (0.8 * i) / candidates.length;
    const span = 0.8 / candidates.length;
    try {
      results.push(
        await encodeFormat(format, src, {
          codecs,
          profile: opts.profile,
          quality: opts.quality,
          hasAlpha,
          signal: hooks.signal,
          progress: (f) => progress(base + span * f, label),
        }),
      );
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      if (candidates.length === 1) {
        throw new ProcessingError('encode-failed', `Falló la codificación ${FORMAT_LABEL[format]}: ${(e as Error).message}`);
      }
      warnings.push(`No se pudo probar ${FORMAT_LABEL[format]}.`);
    }
  }
  if (!results.length) throw new ProcessingError('encode-failed', 'Ningún formato pudo codificar la imagen.');
  results.sort((a, b) => a.bytes.length - b.bytes.length);
  const chosen = results[0];
  let bytes = chosen.bytes;

  // 6. Metadata
  if (opts.metadata.keep) {
    if (chosen.format === 'jpeg' && info.kind === 'jpeg') {
      const app1 = extractExif(input);
      if (app1) {
        try {
          const { exif, removedGps } = rewriteExif(app1, opts.metadata.keepLocation);
          bytes = insertApp1(bytes, exif);
          if (removedGps) warnings.push('Se ha quitado la ubicación GPS de los metadatos.');
        } catch {
          warnings.push('Los metadatos EXIF originales estaban dañados y no se han copiado.');
        }
      }
    } else {
      warnings.push('Los metadatos solo se conservan de JPEG a JPEG; en este archivo se han eliminado.');
    }
  }

  // 7. Never hand back something bigger without saying so
  const converted = chosen.format !== info.kind;
  let usedOriginal = false;
  let larger = false;
  if (bytes.length >= input.length) {
    if (!converted && !resized && opts.keepOriginalIfLarger) {
      usedOriginal = true;
      bytes = input;
      warnings.push('No se pudo reducir más: se conserva el archivo original.');
    } else {
      larger = bytes.length > input.length;
      if (larger) warnings.push('El resultado ocupa más que el original.');
    }
  }
  progress(1, 'Terminado');

  return {
    bytes,
    format: usedOriginal ? info.kind : chosen.format,
    mime: MIME[usedOriginal ? info.kind : chosen.format],
    width: img.width,
    height: img.height,
    quality: usedOriginal ? undefined : chosen.quality,
    lossless: usedOriginal || chosen.lossless,
    ssim: usedOriginal ? undefined : chosen.ssim,
    usedOriginal,
    larger,
    warnings,
    candidates: results.length > 1 ? results.map((r) => ({ format: r.format, size: r.bytes.length })) : undefined,
    ms: Math.round(now() - t0),
  };
}
