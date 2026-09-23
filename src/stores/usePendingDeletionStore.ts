import { create } from 'zustand';
import type { CategoryId } from '../types/domain';

export interface PendingItem {
  /** PHAsset localIdentifier. */
  id: string;
  category: CategoryId;
  bytes: number;
}

interface PendingDeletionState {
  /** Keyed by asset id, so adding the same item twice (e.g. re-tapping
   *  "Add to Review" without leaving the screen) never duplicates it. */
  items: Map<string, PendingItem>;
  add: (newItems: PendingItem[]) => void;
  remove: (id: string) => void;
  clear: () => void;
}

/**
 * The single funnel every deletion passes through, regardless of which
 * category screen it came from. This is what makes "nothing is deleted
 * without going through Review" a structural property rather than a
 * convention each screen has to remember to honour — Screenshots, Large
 * Videos, and Similar Photos all just add() here and navigate to Review;
 * only Review ever calls the native delete.
 *
 * Duplicate Contacts is deliberately not part of this cart — merge/delete
 * there are immediate actions with their own confirmation (phase 5), since a
 * contact merge doesn't fit the "total bytes freed" shape this cart is for.
 */
export const usePendingDeletionStore = create<PendingDeletionState>((set) => ({
  items: new Map(),
  add: (newItems) =>
    set(state => {
      const next = new Map(state.items);
      for (const item of newItems) next.set(item.id, item);
      return { items: next };
    }),
  remove: (id) =>
    set(state => {
      const next = new Map(state.items);
      next.delete(id);
      return { items: next };
    }),
  clear: () => set({ items: new Map() }),
}));

export const pendingTotalBytes = (items: Map<string, PendingItem>): number => {
  let total = 0;
  for (const item of items.values()) total += item.bytes;
  return total;
};
