import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /** Bytes ClrUp has freed for this user across every session, ever. */
  getLifetimeFreedBytes(): Promise<number>;
  /** Adds to the running total (persisted natively) and returns the new total. */
  addLifetimeFreedBytes(bytes: number): Promise<number>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('AppStats');
