import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * String unions can't cross the codegen boundary directly, so the native side
 * returns plain strings and the typed enum lives at the JS wrapper
 * (`usePermissions`), matching every other native/JS boundary in this app.
 * Native only ever emits one of PhotosAuthorizationStatus's values below.
 */
export type PhotosAuthorizationStatus =
  | 'notDetermined'
  | 'restricted'
  | 'denied'
  | 'authorized'
  | 'limited';

export type ContactsAuthorizationStatus = 'notDetermined' | 'restricted' | 'denied' | 'authorized';

export interface Spec extends TurboModule {
  /** Current status, without prompting. Safe to call on every screen focus. */
  getPhotosAuthorizationStatus(): Promise<string>;
  /** Triggers the system prompt if, and only if, status is `notDetermined`. */
  requestPhotosAuthorization(): Promise<string>;
  /**
   * Presents Apple's picker for adding more photos to a `.limited` grant.
   * Resolves once the sheet is dismissed; call `getPhotosAuthorizationStatus`
   * again afterwards to see whether the user actually changed anything.
   */
  presentLimitedLibraryPicker(): Promise<void>;

  getContactsAuthorizationStatus(): Promise<string>;
  requestContactsAuthorization(): Promise<string>;

  /** Deep-links to this app's page in Settings, for the `denied` recovery path. */
  openSettings(): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Permissions');
