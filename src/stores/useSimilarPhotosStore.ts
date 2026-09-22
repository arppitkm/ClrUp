import { create } from 'zustand';
import NativeSimilarPhotos, { type SimilarGroup } from '../native/NativeSimilarPhotos';

export type SimilarPhotosStatus = 'idle' | 'scanning' | 'ready' | 'error';

interface SimilarPhotosState {
  status: SimilarPhotosStatus;
  groups: SimilarGroup[];
  error: string | null;
  /**
   * Unlike the fast metadata-only scan store, this call *is* the full
   * pipeline (bucketing, Vision comparison, quality ranking) — there's no
   * cheaper "just the summary" variant, so the dashboard and the Similar
   * Photos screen both read from this one result.
   */
  scan: () => Promise<void>;
}

export const useSimilarPhotosStore = create<SimilarPhotosState>((set, get) => ({
  status: 'idle',
  groups: [],
  error: null,
  scan: async () => {
    if (get().status === 'scanning') return;
    set({ status: 'scanning', error: null });
    try {
      const groups = await NativeSimilarPhotos.scanSimilarPhotos();
      set({ status: 'ready', groups });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Could not scan for similar photos.',
      });
    }
  },
}));

/** Every non-"best" asset across every group — what's actually being suggested for removal. */
export const similarPhotosItemCount = (groups: SimilarGroup[]): number =>
  groups.reduce((sum, g) => sum + Math.max(0, g.assets.length - 1), 0);

export const similarPhotosReclaimableBytes = (groups: SimilarGroup[]): number =>
  groups.reduce((sum, g) => sum + g.reclaimableBytes, 0);
