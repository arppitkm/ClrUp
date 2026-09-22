/**
 * Byte formatting.
 *
 * Uses base-1000 (GB, not GiB) to match what iOS Settings shows the user. A
 * cleaner that disagrees with Settings about how much space exists looks broken,
 * even when it is technically more correct.
 */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export type FormattedSize = {
  /** Numeric part, already rounded for display. */
  value: string;
  unit: (typeof UNITS)[number];
  /** `value` and `unit` joined with a space. */
  text: string;
};

/**
 * Picks a unit and a sensible precision: more decimals for small numbers, none
 * once the figure is large enough that decimals are noise.
 */
export const formatBytes = (bytes: number): FormattedSize => {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;

  let index = 0;
  let size = safe;
  while (size >= 1000 && index < UNITS.length - 1) {
    size /= 1000;
    index += 1;
  }

  const decimals = index === 0 || size >= 100 ? 0 : 1;
  const value = size.toFixed(decimals);
  // `index` is clamped by the loop above; the fallback satisfies the compiler.
  const unit = UNITS[index] ?? 'B';

  return { value, unit, text: `${value} ${unit}` };
};

/** Convenience for the common "4.2 GB" case. */
export const formatBytesText = (bytes: number): string => formatBytes(bytes).text;

/** "1 photo" / "248 photos", so call sites stop hand-rolling plurals. */
export const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count.toLocaleString()} ${count === 1 ? singular : plural}`;

/** "0:47" under a minute, "12:03" at or past one — the pattern every video app uses. */
export const formatDuration = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
