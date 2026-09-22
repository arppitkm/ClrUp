import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * How sure the native side is that a group is genuinely duplicates/near-
 * duplicates. Mirrors `Confidence` in `types/domain.ts` — kept as a plain
 * string across the codegen boundary, narrowed to the typed union in the JS
 * wrapper, same pattern as Permissions' authorization statuses.
 */
export type SimilarityConfidence = 'exact' | 'high' | 'medium';

export interface SimilarAsset {
  id: string;
  createdAt: number;
  widthPx: number;
  heightPx: number;
  bytes: number;
  /** True for exactly one asset per group — the one the algorithm picked to keep. */
  isBest: boolean;
}

export interface SimilarGroup {
  id: string;
  confidence: string;
  assets: SimilarAsset[];
  /** Sum of every non-best asset's bytes — what deleting the rest of this group frees. */
  reclaimableBytes: number;
}

export interface Spec extends TurboModule {
  /**
   * The expensive one: metadata bucketing (burst ID / time / location) then
   * Vision feature-print comparison within each bucket, then union-find
   * grouping, then a quality pass to pick the keeper. Runs off the JS thread;
   * resolves with only photos that have at least one near-duplicate —
   * everything else in the library is implicitly "fine as is" and omitted.
   */
  scanSimilarPhotos(): Promise<SimilarGroup[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('SimilarPhotos');
