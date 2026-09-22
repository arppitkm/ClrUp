import { create } from 'zustand';
import NativePhotoScanner, { type LibrarySummary } from '../native/NativePhotoScanner';

export type ScanStatus = 'idle' | 'scanning' | 'ready' | 'error';

interface ScanState {
  status: ScanStatus;
  summary: LibrarySummary | null;
  error: string | null;
  /**
   * Metadata-only pass (PHFetchResult counts/sizes, no decoding), so this is
   * fast even on a large library — safe to call eagerly once Photos access
   * exists, with no progress UI required. Individual screens fetch their own
   * full asset lists and thumbnails lazily, on demand.
   */
  scan: () => Promise<void>;
}

/**
 * Single source of truth for "how much is reclaimable in Screenshots and
 * Large Videos", replacing the dashboard's placeholder numbers for those two
 * categories. Similar Photos and Duplicate Contacts stay placeholder-driven
 * until their own native work lands (Vision similarity, Contacts).
 */
export const useScanStore = create<ScanState>((set, get) => ({
  status: 'idle',
  summary: null,
  error: null,
  scan: async () => {
    if (get().status === 'scanning') return;
    set({ status: 'scanning', error: null });
    try {
      const summary = await NativePhotoScanner.getLibrarySummary();
      set({ status: 'ready', summary });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Could not scan photo library.',
      });
    }
  },
}));
