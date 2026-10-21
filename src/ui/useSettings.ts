import { useEffect, useState } from 'react';
import { DEFAULT_OPTIONS, type ProcessOptions } from '../engine/types';

const KEY = 'comprimo:settings:v1';

function load(): ProcessOptions {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_OPTIONS;
    const parsed = JSON.parse(raw) as Partial<ProcessOptions>;
    return {
      ...DEFAULT_OPTIONS,
      ...parsed,
      resize: { ...DEFAULT_OPTIONS.resize, ...parsed.resize },
      metadata: { ...DEFAULT_OPTIONS.metadata, ...parsed.metadata },
    };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

/** Settings survive reloads in this browser only (never sent anywhere). */
export function useSettings() {
  const [options, setOptions] = useState<ProcessOptions>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(options));
    } catch {
      // storage may be unavailable (private mode); settings then last for this visit only
    }
  }, [options]);
  return [options, setOptions] as const;
}
