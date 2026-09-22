import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** Kept as a plain string across the codegen boundary — see SimilarPhotos for the same pattern. */
export type ContactMatchConfidence = 'high' | 'low';

export interface ContactSummary {
  id: string;
  displayName: string;
  phones: string[];
  emails: string[];
}

export interface ContactDuplicateGroup {
  id: string;
  confidence: string;
  /** Why these were grouped, e.g. ["phone"], ["email"], ["name"] — shown in the UI so the match reason is never a mystery. */
  matchedOn: string[];
  contacts: ContactSummary[];
}

export interface Spec extends TurboModule {
  /**
   * Two passes: exact match on normalized phone/email ('high' confidence),
   * then fuzzy name matching ('low' confidence, since a name alone is weak
   * corroboration). Read-only — no contact is touched until the user picks
   * an action for its group.
   */
  scanDuplicateContacts(): Promise<ContactDuplicateGroup[]>;

  /**
   * Keeps `primaryId`, unions every phone/email from `duplicateIds` onto it,
   * then deletes the duplicates. The default, non-destructive action — no
   * contact data is lost, cards are just combined.
   */
  mergeContacts(primaryId: string, duplicateIds: string[]): Promise<void>;

  /** Secondary action: removes the given contacts outright, no merging. */
  deleteContacts(ids: string[]): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('ContactsDuplicates');
