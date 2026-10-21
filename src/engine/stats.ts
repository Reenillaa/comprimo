export interface Savings {
  bytes: number;
  /** Positive = smaller. Negative = result is larger. One decimal. */
  percent: number;
}

export function savings(original: number, result: number): Savings {
  if (original <= 0) return { bytes: 0, percent: 0 };
  const bytes = original - result;
  return { bytes, percent: Math.round((bytes / original) * 1000) / 10 };
}

export function totals(items: { original: number; result: number }[]): Savings & { original: number; result: number } {
  const original = items.reduce((s, i) => s + i.original, 0);
  const result = items.reduce((s, i) => s + i.result, 0);
  return { original, result, ...savings(original, result) };
}

const nf = (digits: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** Decimal units (1 kB = 1000 B), like most operating systems show for files. */
export function formatBytes(n: number): string {
  const abs = Math.abs(n);
  if (abs < 1000) return `${n} B`;
  if (abs < 1_000_000) return `${nf(abs < 10_000 ? 1 : 0).format(n / 1000)} kB`;
  if (abs < 1_000_000_000) return `${nf(1).format(n / 1_000_000)} MB`;
  return `${nf(2).format(n / 1_000_000_000)} GB`;
}

export function formatPercent(p: number): string {
  return `${nf(1).format(p)} %`;
}
