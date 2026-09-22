import { create } from 'zustand';
import NativeContactsDuplicates, {
  type ContactDuplicateGroup,
} from '../native/NativeContactsDuplicates';

export type ContactsScanStatus = 'idle' | 'scanning' | 'ready' | 'error';

interface ContactsState {
  status: ContactsScanStatus;
  groups: ContactDuplicateGroup[];
  error: string | null;
  scan: () => Promise<void>;
}

/**
 * Detection only — merge/delete are separate native calls the screen invokes
 * directly after the user confirms an action, then re-scans to refresh from
 * the actual source of truth rather than guessing at client-side state.
 */
export const useContactsStore = create<ContactsState>((set, get) => ({
  status: 'idle',
  groups: [],
  error: null,
  scan: async () => {
    if (get().status === 'scanning') return;
    set({ status: 'scanning', error: null });
    try {
      const groups = await NativeContactsDuplicates.scanDuplicateContacts();
      set({ status: 'ready', groups });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Could not scan contacts.',
      });
    }
  },
}));

/** Total contacts that would go away if every group merged to its keeper — what the dashboard shows. */
export const duplicateContactCount = (groups: ContactDuplicateGroup[]): number =>
  groups.reduce((sum, g) => sum + Math.max(0, g.contacts.length - 1), 0);
