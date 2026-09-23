import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface BlurryAsset {
  id: string;
  createdAt: number;
  widthPx: number;
  heightPx: number;
  bytes: number;
  /** Lower is blurrier. Not shown in the UI — kept for debugging/tuning the threshold. */
  sharpnessScore: number;
}

export interface Spec extends TurboModule {
  /**
   * Variance-of-Laplacian blur scoring across every non-screenshot photo —
   * unlike similar-photo grouping, there's no metadata shortcut for "is this
   * in focus", so every candidate gets a real pixel decode. Resolves with
   * only photos that fall below the native side's threshold, blurriest
   * first; everything else is implicitly "sharp enough" and omitted.
   */
  scanBlurryPhotos(): Promise<BlurryAsset[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BlurryPhotos');
