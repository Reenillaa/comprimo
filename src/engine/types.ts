export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'jxl';

/** 'same' keeps the input format; 'auto' picks the smallest among browser-friendly candidates. */
export type OutputFormat = 'same' | 'auto' | ImageFormat;

export type ResizeMode = 'none' | 'scale' | 'fit' | 'cover' | 'percent';

export interface ResizeOptions {
  mode: ResizeMode;
  width?: number;
  height?: number;
  percent?: number;
}

export type Profile = 'web' | 'photo' | 'transparency' | 'graphics';

export interface MetadataOptions {
  /** Keep EXIF (JPEG output only). Orientation is reset to 1 because pixels are already rotated. */
  keep: boolean;
  /** Keep GPS location inside the kept EXIF. */
  keepLocation: boolean;
}

export interface ProcessOptions {
  output: OutputFormat;
  quality: 'auto' | number;
  profile: Profile;
  resize: ResizeOptions;
  metadata: MetadataOptions;
  /** Hex colour used when transparency must be flattened (e.g. PNG → JPEG). */
  background: string;
  /** When the result is not smaller and nothing else changed, hand back the original bytes. */
  keepOriginalIfLarger: boolean;
}

export interface ProcessResult {
  bytes: Uint8Array;
  format: ImageFormat;
  mime: string;
  width: number;
  height: number;
  /** Encoder quality actually used (undefined for lossless). */
  quality?: number;
  lossless: boolean;
  /** Similarity to the (resized) source, 0..1, measured on the delivered bytes when available. */
  ssim?: number;
  usedOriginal: boolean;
  /** Result is larger than the original (only possible when converting/resizing). */
  larger: boolean;
  warnings: string[];
  /** Candidates tried in auto-format mode, smallest first. */
  candidates?: { format: ImageFormat; size: number }[];
  /** Small WebP preview of the result (only when requested). */
  thumbnail?: Uint8Array;
  ms: number;
}

export type ProgressFn = (fraction: number, label: string) => void;

export class ProcessingError extends Error {
  constructor(
    public code:
      | 'unsupported'
      | 'corrupt'
      | 'animated'
      | 'too-large'
      | 'encode-failed'
      | 'invalid-options',
    message: string,
  ) {
    super(message);
    this.name = 'ProcessingError';
  }
}

export const MIME: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  jxl: 'image/jxl',
};

export const EXTENSION: Record<ImageFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
  jxl: 'jxl',
};

export const FORMAT_LABEL: Record<ImageFormat, string> = {
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  avif: 'AVIF',
  jxl: 'JPEG XL',
};

/** Technical (not commercial) ceiling: 32-bit WASM heaps cap at 4 GB and codecs need several copies. */
export const MAX_PIXELS = 100_000_000;

export const DEFAULT_OPTIONS: ProcessOptions = {
  output: 'same',
  quality: 'auto',
  profile: 'web',
  resize: { mode: 'none' },
  metadata: { keep: false, keepLocation: false },
  background: '#ffffff',
  keepOriginalIfLarger: true,
};
