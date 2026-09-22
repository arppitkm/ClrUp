import type { CategoryId } from '../design-system/tokens';

export type { CategoryId };

/**
 * How sure the app is that an item is safe to remove. This drives whether an
 * item is pre-selected: `exact` and `high` are, `medium` and `low` never are.
 * The app is allowed to guess; it is not allowed to guess on the user's behalf.
 */
export type Confidence = 'exact' | 'high' | 'medium' | 'low';

/** Per-category summary shown on the dashboard. */
export type CategorySummary = {
  id: CategoryId;
  /** Items that could be removed. */
  itemCount: number;
  /** Space those items occupy. Zero for contacts, which free no meaningful space. */
  reclaimableBytes: number;
};

export type ScanPhase = 'idle' | 'requestingPermission' | 'scanning' | 'complete' | 'failed';

export type ScanProgress = {
  phase: ScanPhase;
  /** 0–1, or null when the total isn't known yet. */
  fraction: number | null;
  /** Human-readable step, e.g. "Comparing 1,240 photos". */
  detail: string | null;
};

/** Device storage, as reported by the OS. */
export type DeviceStorage = {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
};
