import { create } from 'zustand';
import NativeAppStats from '../native/NativeAppStats';

interface AppStatsState {
  lifetimeFreedBytes: number;
  loaded: boolean;
  load: () => Promise<void>;
  add: (bytes: number) => Promise<number>;
}

/** The one number the app remembers across sessions: total space freed, ever. */
export const useAppStatsStore = create<AppStatsState>((set) => ({
  lifetimeFreedBytes: 0,
  loaded: false,
  load: async () => {
    const total = await NativeAppStats.getLifetimeFreedBytes();
    set({ lifetimeFreedBytes: total, loaded: true });
  },
  add: async (bytes) => {
    const total = await NativeAppStats.addLifetimeFreedBytes(bytes);
    set({ lifetimeFreedBytes: total, loaded: true });
    return total;
  },
}));
