import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NativePermissions, {
  type ContactsAuthorizationStatus,
  type PhotosAuthorizationStatus,
} from '../native/NativePermissions';

const PHOTOS_STATUSES: readonly PhotosAuthorizationStatus[] = [
  'notDetermined',
  'restricted',
  'denied',
  'authorized',
  'limited',
];
const CONTACTS_STATUSES: readonly ContactsAuthorizationStatus[] = [
  'notDetermined',
  'restricted',
  'denied',
  'authorized',
];

// Native only ever emits one of the values above; an unrecognized string is
// treated as the safest (most restrictive) status rather than crashing or
// silently unlocking access.
const asPhotosStatus = (value: string): PhotosAuthorizationStatus =>
  (PHOTOS_STATUSES as readonly string[]).includes(value)
    ? (value as PhotosAuthorizationStatus)
    : 'denied';

const asContactsStatus = (value: string): ContactsAuthorizationStatus =>
  (CONTACTS_STATUSES as readonly string[]).includes(value)
    ? (value as ContactsAuthorizationStatus)
    : 'denied';

export interface PermissionsState {
  photos: PhotosAuthorizationStatus;
  contacts: ContactsAuthorizationStatus;
  /** True only while the initial read is in flight; actions have their own pending state. */
  loading: boolean;
}

/**
 * Central owner of Photos/Contacts authorization state. Screens read status
 * from here rather than calling the native module directly, and re-request
 * only ever happens in response to an explicit user action (never silently on
 * mount) — the brief requires a clear reason shown before the system prompt,
 * which is the caller's job, not this hook's.
 */
export const usePermissions = () => {
  const [state, setState] = useState<PermissionsState>({
    photos: 'notDetermined',
    contacts: 'notDetermined',
    loading: true,
  });
  // Guards against a stale async response landing after unmount.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const [photos, contacts] = await Promise.all([
      NativePermissions.getPhotosAuthorizationStatus(),
      NativePermissions.getContactsAuthorizationStatus(),
    ]);
    if (!mounted.current) return;
    setState({ photos: asPhotosStatus(photos), contacts: asContactsStatus(contacts), loading: false });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Recovery path for "denied": the user leaves for Settings, flips the
  // toggle, and returns — reflect that without asking them to pull-to-refresh.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        refresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  const requestPhotos = useCallback(async () => {
    const status = await NativePermissions.requestPhotosAuthorization();
    const typed = asPhotosStatus(status);
    if (mounted.current) setState(prev => ({ ...prev, photos: typed }));
    return typed;
  }, []);

  const requestContacts = useCallback(async () => {
    const status = await NativePermissions.requestContactsAuthorization();
    const typed = asContactsStatus(status);
    if (mounted.current) setState(prev => ({ ...prev, contacts: typed }));
    return typed;
  }, []);

  const presentLimitedLibraryPicker = useCallback(async () => {
    await NativePermissions.presentLimitedLibraryPicker();
    // The picker can change or reaffirm the .limited selection; either way
    // the status itself doesn't change, but the underlying asset set does.
    await refresh();
  }, [refresh]);

  const openSettings = useCallback(async () => {
    await NativePermissions.openSettings();
  }, []);

  return {
    ...state,
    refresh,
    requestPhotos,
    requestContacts,
    presentLimitedLibraryPicker,
    openSettings,
  };
};
