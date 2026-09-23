import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  /** PHAsset localIdentifiers currently marked private. */
  getPrivateAssetIds(): Promise<string[]>;
  /** Adds ids to the private list (already-present ones are a no-op) and returns the full updated list. */
  addPrivateAssetIds(ids: string[]): Promise<string[]>;
  /** Unmarks ids — never deletes the underlying photo — and returns the full updated list. */
  removePrivateAssetIds(ids: string[]): Promise<string[]>;
  /**
   * Gates access with Face ID/Touch ID, falling back to the device passcode
   * automatically if biometrics fail or aren't enrolled — this is what "PIN
   * or Face ID protected" means here, with no custom PIN screen needed.
   */
  authenticate(reason: string): Promise<boolean>;
  /** Apple's own multi-select photo/video picker. Resolves with the PHAsset localIdentifiers picked. */
  presentAssetPicker(): Promise<string[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('PrivateVault');
