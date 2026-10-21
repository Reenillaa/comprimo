import { useEffect, useState } from 'react';
import { DEFAULT_OPTIONS, type ProcessOptions } from '../engine/types';

const KEY = 'comprimo:settings:v1';

function readJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage may be unavailable (private mode); the value then lasts for this visit only
  }
}

function load(): ProcessOptions {
  const parsed = readJson<Partial<ProcessOptions>>(KEY);
  if (!parsed) return DEFAULT_OPTIONS;
  return {
    ...DEFAULT_OPTIONS,
    ...parsed,
    resize: { ...DEFAULT_OPTIONS.resize, ...parsed.resize },
    metadata: { ...DEFAULT_OPTIONS.metadata, ...parsed.metadata },
  };
}

/** Settings survive reloads on this device only (never sent anywhere). */
export function useSettings() {
  const [options, setOptions] = useState<ProcessOptions>(load);
  useEffect(() => writeJson(KEY, options), [options]);
  return [options, setOptions] as const;
}

/** A small persisted UI preference (theme, view, suffix). */
export function usePersistent<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readJson<T>(key) ?? initial);
  useEffect(() => writeJson(key, value), [key, value]);
  return [value, setValue] as const;
}
