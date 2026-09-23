import { create } from 'zustand';
import NativeBlurryPhotos, { type BlurryAsset } from '../native/NativeBlurryPhotos';

export type BlurryPhotosStatus = 'idle' | 'scanning' | 'ready' | 'error';

interface BlurryPhotosState {
  status: BlurryPhotosStatus;
  assets: BlurryAsset[];
  error: string | null;
  scan: () => Promise<void>;
}

export const useBlurryPhotosStore = create<BlurryPhotosState>((set, get) => ({
  status: 'idle',
  assets: [],
  error: null,
  scan: async () => {
    if (get().status === 'scanning') return;
    set({ status: 'scanning', error: null });
    try {
      const assets = await NativeBlurryPhotos.scanBlurryPhotos();
      set({ status: 'ready', assets });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Could not scan for blurry photos.',
      });
    }
  },
}));

export const blurryPhotosReclaimableBytes = (assets: BlurryAsset[]): number =>
  assets.reduce((sum, a) => sum + a.bytes, 0);
