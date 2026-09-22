import type { CategoryId } from '../types/domain';

/**
 * Every destructive path routes through `Review`, which is what makes "nothing
 * is deleted without approval" a structural property rather than a convention.
 */
export type RootStackParamList = {
  Dashboard: undefined;
  SimilarPhotos: undefined;
  Screenshots: undefined;
  LargeVideos: undefined;
  DuplicateContacts: undefined;
  Review: { from: CategoryId | 'dashboard' };
  Result: { freedBytes: number; itemCount: number };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
