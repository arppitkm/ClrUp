import { create } from 'zustand';
import NativePrivateVault from '../native/NativePrivateVault';

type VaultStatus = 'idle' | 'loading' | 'ready' | 'error';

interface PrivateVaultState {
  status: VaultStatus;
  ids: string[];
  /** Re-armed to false every time the Vault screen loses focus — there is no "stay unlocked" session. */
  unlocked: boolean;
  load: () => Promise<void>;
  addIds: (ids: string[]) => Promise<void>;
  removeIds: (ids: string[]) => Promise<void>;
  authenticate: () => Promise<boolean>;
  lock: () => void;
}

export const usePrivateVaultStore = create<PrivateVaultState>((set) => ({
  status: 'idle',
  ids: [],
  unlocked: false,
  load: async () => {
    set({ status: 'loading' });
    try {
      const ids = await NativePrivateVault.getPrivateAssetIds();
      set({ status: 'ready', ids });
    } catch {
      set({ status: 'error' });
    }
  },
  addIds: async (newIds) => {
    const ids = await NativePrivateVault.addPrivateAssetIds(newIds);
    set({ ids });
  },
  removeIds: async (removeIds) => {
    const ids = await NativePrivateVault.removePrivateAssetIds(removeIds);
    set({ ids });
  },
  authenticate: async () => {
    const success = await NativePrivateVault.authenticate('Unlock your Private Vault');
    if (success) set({ unlocked: true });
    return success;
  },
  lock: () => set({ unlocked: false, status: 'idle', ids: [] }),
}));
