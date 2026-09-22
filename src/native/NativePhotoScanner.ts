import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Fast, metadata-only counts. Backed by PHFetchResult, which is a lazy view
 * over the Photos database — this never decodes a single pixel, which is why
 * it stays fast even on a large library and needs no progress UI.
 */
export interface LibrarySummary {
  screenshotCount: number;
  screenshotBytes: number;
  largeVideoCount: number;
  largeVideoBytes: number;
}

/** One row in the Screenshots grid. No pixel data — thumbnails are requested separately. */
export interface ScreenshotAsset {
  id: string;
  createdAt: number;
  widthPx: number;
  heightPx: number;
  bytes: number;
}

/** One row in the Large Videos list, already sorted largest-first by the native side. */
export interface VideoAsset {
  id: string;
  createdAt: number;
  widthPx: number;
  heightPx: number;
  durationSeconds: number;
  bytes: number;
}

export interface Spec extends TurboModule {
  getLibrarySummary(): Promise<LibrarySummary>;
  listScreenshots(): Promise<ScreenshotAsset[]>;
  /** Sorted largest-to-smallest. `limit` caps the result for very large libraries. */
  listLargeVideos(limit: number): Promise<VideoAsset[]>;
  /**
   * Renders (or reads from cache) a JPEG thumbnail and returns a `file://`
   * URI — never base64 over the bridge, which would be fatal on a large grid.
   */
  requestThumbnail(assetId: string, targetWidthPx: number): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('PhotoScanner');
