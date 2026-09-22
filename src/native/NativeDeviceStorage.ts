import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Raw device capacity, straight from the filesystem. Kept as plain numbers
 * here — the typed, human-friendly layer (formatting, "is this trustworthy on
 * a simulator" labelling) lives in `useDeviceStorage`, not in the native spec.
 */
export interface DeviceStorageSnapshot {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  /**
   * True when running on the iOS Simulator, where these figures describe the
   * host Mac's disk, not a phone's. Decided natively via `targetEnvironment(simulator)`
   * rather than guessed in JS, since that's the only fully reliable signal.
   */
  isSimulator: boolean;
}

export interface Spec extends TurboModule {
  /**
   * Reads `URLResourceKey.volumeAvailableCapacityForImportantUsageKey` for
   * free space (the accurate, non-deprecated API) alongside total volume
   * capacity. Rejects if the query fails outright; never returns negative or
   * NaN figures.
   */
  getDeviceStorage(): Promise<DeviceStorageSnapshot>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('DeviceStorage');
