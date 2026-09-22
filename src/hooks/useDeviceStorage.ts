import { useCallback, useEffect, useState } from 'react';
import NativeDeviceStorage, { type DeviceStorageSnapshot } from '../native/NativeDeviceStorage';

export type DeviceStorageState =
  | { status: 'loading' }
  | { status: 'ready'; storage: DeviceStorageSnapshot }
  | { status: 'error'; message: string };

/**
 * Reads real device capacity on mount. On the Simulator this reports the host
 * Mac's disk, not a phone's — `storage.isSimulator` is threaded through
 * everywhere so the UI can label those figures rather than present them as
 * real, and this hook never fabricates a "phone-like" number to hide that.
 */
export const useDeviceStorage = () => {
  const [state, setState] = useState<DeviceStorageState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const storage = await NativeDeviceStorage.getDeviceStorage();
      setState({ status: 'ready', storage });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not read device storage.',
      });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
};
