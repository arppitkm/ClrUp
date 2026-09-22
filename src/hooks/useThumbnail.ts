import { useEffect, useState } from 'react';
import NativePhotoScanner from '../native/NativePhotoScanner';

// Shared across every mounted cell: two grid items for the same asset (e.g.
// during a fast re-render) reuse one in-flight request instead of asking the
// native side to decode the same image twice.
const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

const keyFor = (assetId: string, width: number) => `${assetId}@${width}`;

/** `file://` URI for an asset's thumbnail, rendered/cached natively on first request. */
export const useThumbnail = (assetId: string, targetWidthPx: number): string | null => {
  const key = keyFor(assetId, targetWidthPx);
  const [uri, setUri] = useState<string | null>(cache.get(key) ?? null);

  useEffect(() => {
    let cancelled = false;
    const cached = cache.get(key);
    if (cached) {
      setUri(cached);
      return;
    }

    let request = inFlight.get(key);
    if (!request) {
      request = NativePhotoScanner.requestThumbnail(assetId, targetWidthPx);
      inFlight.set(key, request);
    }

    request
      .then(result => {
        cache.set(key, result);
        if (!cancelled) setUri(result);
      })
      .catch(err => {
        // Leave uri null — the cell renders its placeholder state instead.
        // Logged rather than fully silent, so a real regression here doesn't
        // read as "just a slow thumbnail" during development.
        if (__DEV__) {
          console.warn(`[useThumbnail] ${assetId}:`, err);
        }
      })
      .finally(() => {
        inFlight.delete(key);
      });

    return () => {
      cancelled = true;
    };
  }, [key, assetId, targetWidthPx]);

  return uri;
};
