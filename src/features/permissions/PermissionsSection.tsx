import React, { useState } from 'react';
import { PermissionCard } from '../../design-system';
import { usePermissions } from '../../hooks/usePermissions';

/**
 * Renders zero, one, or two cards depending on what still needs the user's
 * attention. Nothing here requests access on mount — every request is a
 * direct result of the user tapping the card's own button, which is what
 * keeps the rationale in front of the system prompt rather than behind it.
 */
export const PermissionsSection: React.FC = () => {
  const permissions = usePermissions();
  // Tracks which single action is in flight so only that card's button spins.
  const [pending, setPending] = useState<null | 'photos' | 'contacts' | 'limited'>(null);

  const run = async (key: 'photos' | 'contacts' | 'limited', action: () => Promise<unknown>) => {
    setPending(key);
    try {
      await action();
    } finally {
      setPending(null);
    }
  };

  if (permissions.loading) return null;

  const cards: React.ReactNode[] = [];

  switch (permissions.photos) {
    case 'notDetermined':
      cards.push(
        <PermissionCard
          key="photos-request"
          title="Find similar photos & large videos"
          description="ClrUp scans your photo library on this device to find duplicates, screenshots and large videos you can safely remove. Nothing is uploaded or shared."
          actionLabel="Continue"
          actionLoading={pending === 'photos'}
          onAction={() => run('photos', permissions.requestPhotos)}
        />,
      );
      break;
    case 'limited':
      cards.push(
        <PermissionCard
          key="photos-limited"
          title="Only some photos are visible"
          description="You've given ClrUp access to a selection of your library. Add more so it can find every duplicate and large video."
          actionLabel="Select More Photos"
          actionLoading={pending === 'limited'}
          onAction={() => run('limited', permissions.presentLimitedLibraryPicker)}
        />,
      );
      break;
    case 'denied':
      cards.push(
        <PermissionCard
          key="photos-denied"
          title="Photos access is off"
          description="Turn on Photos access in Settings so ClrUp can scan for duplicates, screenshots and large videos."
          actionLabel="Open Settings"
          onAction={permissions.openSettings}
        />,
      );
      break;
    case 'restricted':
      cards.push(
        <PermissionCard
          key="photos-restricted"
          title="Photos access is restricted"
          description="This device's settings don't allow photo access for any app. ClrUp can't scan photos here."
          actionLabel="Open Settings"
          onAction={permissions.openSettings}
        />,
      );
      break;
    case 'authorized':
      break;
  }

  switch (permissions.contacts) {
    case 'notDetermined':
      cards.push(
        <PermissionCard
          key="contacts-request"
          title="Find duplicate contacts"
          description="ClrUp checks your contacts on this device for duplicates so you can merge or remove them. Nothing leaves your phone."
          actionLabel="Continue"
          actionLoading={pending === 'contacts'}
          onAction={() => run('contacts', permissions.requestContacts)}
        />,
      );
      break;
    case 'denied':
      cards.push(
        <PermissionCard
          key="contacts-denied"
          title="Contacts access is off"
          description="Turn on Contacts access in Settings so ClrUp can find duplicate entries to merge or remove."
          actionLabel="Open Settings"
          onAction={permissions.openSettings}
        />,
      );
      break;
    case 'restricted':
      cards.push(
        <PermissionCard
          key="contacts-restricted"
          title="Contacts access is restricted"
          description="This device's settings don't allow contacts access for any app. ClrUp can't check for duplicates here."
          actionLabel="Open Settings"
          onAction={permissions.openSettings}
        />,
      );
      break;
    case 'authorized':
      break;
  }

  return <>{cards}</>;
};
