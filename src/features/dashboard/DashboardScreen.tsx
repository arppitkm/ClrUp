import React, { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Button,
  CategoryRow,
  Screen,
  StorageRing,
  Text,
  useTheme,
  type RingSegment,
} from '../../design-system';
import { useDeviceStorage } from '../../hooks/useDeviceStorage';
import { usePermissions } from '../../hooks/usePermissions';
import { useScanStore } from '../../stores/useScanStore';
import {
  similarPhotosItemCount,
  similarPhotosReclaimableBytes,
  useSimilarPhotosStore,
} from '../../stores/useSimilarPhotosStore';
import { duplicateContactCount, useContactsStore } from '../../stores/useContactsStore';
import { formatBytesText, pluralize } from '../../lib/format';
import type { RootStackParamList } from '../../navigation/types';
import type { CategoryId, CategorySummary } from '../../types/domain';
import { PermissionsSection } from '../permissions/PermissionsSection';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Display metadata per category. Route is what the row navigates to. */
const CATEGORIES: ReadonlyArray<{
  id: CategoryId;
  label: string;
  route: keyof RootStackParamList;
  /** Contacts are counted, not measured — they free no meaningful space. */
  measuredInBytes: boolean;
}> = [
  { id: 'similarPhotos', label: 'Similar Photos', route: 'SimilarPhotos', measuredInBytes: true },
  { id: 'screenshots', label: 'Screenshots', route: 'Screenshots', measuredInBytes: true },
  { id: 'largeVideos', label: 'Large Videos', route: 'LargeVideos', measuredInBytes: true },
  {
    id: 'duplicateContacts',
    label: 'Duplicate Contacts',
    route: 'DuplicateContacts',
    measuredInBytes: false,
  },
];

/**
 * Fallback shown before each category's own scan has produced a real result
 * — every category is now backed by a real native scanner.
 */
const PLACEHOLDER: Record<CategoryId, CategorySummary> = {
  similarPhotos: { id: 'similarPhotos', itemCount: 0, reclaimableBytes: 0 },
  screenshots: { id: 'screenshots', itemCount: 0, reclaimableBytes: 0 },
  largeVideos: { id: 'largeVideos', itemCount: 0, reclaimableBytes: 0 },
  duplicateContacts: { id: 'duplicateContacts', itemCount: 0, reclaimableBytes: 0 },
};

export const DashboardScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const deviceStorage = useDeviceStorage();
  const permissions = usePermissions();
  const scan = useScanStore();
  const similar = useSimilarPhotosStore();
  const contacts = useContactsStore();
  // Selected separately so the effects below depend on stable function
  // references rather than the whole store object, which changes identity on
  // every status/summary update.
  const runScan = useScanStore(s => s.scan);
  const runSimilarScan = useSimilarPhotosStore(s => s.scan);
  const runContactsScan = useContactsStore(s => s.scan);

  // Both photo scans need at least some Photos access; `.limited` still lets
  // us scan whatever the user has granted. Each runs once per permission
  // grant — the stores themselves guard against overlapping scans.
  useEffect(() => {
    if (permissions.photos === 'authorized' || permissions.photos === 'limited') {
      runScan();
      runSimilarScan();
    }
  }, [permissions.photos, runScan, runSimilarScan]);

  useEffect(() => {
    if (permissions.contacts === 'authorized') {
      runContactsScan();
    }
  }, [permissions.contacts, runContactsScan]);

  // Only show a category row as "pending" once its scan has actually been
  // requested — before permission is granted, `idle` just means nothing has
  // been asked for yet, not that a scan is running.
  const scanPending = scan.status === 'scanning';
  const similarPending = similar.status === 'scanning';
  const contactsPending = contacts.status === 'scanning';

  const summaries = useMemo<Record<CategoryId, CategorySummary>>(() => {
    let next = PLACEHOLDER;
    if (scan.status === 'ready' && scan.summary) {
      next = {
        ...next,
        screenshots: {
          id: 'screenshots',
          itemCount: scan.summary.screenshotCount,
          reclaimableBytes: scan.summary.screenshotBytes,
        },
        largeVideos: {
          id: 'largeVideos',
          itemCount: scan.summary.largeVideoCount,
          reclaimableBytes: scan.summary.largeVideoBytes,
        },
      };
    }
    if (similar.status === 'ready') {
      next = {
        ...next,
        similarPhotos: {
          id: 'similarPhotos',
          itemCount: similarPhotosItemCount(similar.groups),
          reclaimableBytes: similarPhotosReclaimableBytes(similar.groups),
        },
      };
    }
    if (contacts.status === 'ready') {
      next = {
        ...next,
        duplicateContacts: {
          id: 'duplicateContacts',
          itemCount: duplicateContactCount(contacts.groups),
          reclaimableBytes: 0,
        },
      };
    }
    return next;
  }, [scan.status, scan.summary, similar.status, similar.groups, contacts.status, contacts.groups]);

  const segments = useMemo<RingSegment[]>(
    () =>
      CATEGORIES.filter(c => c.measuredInBytes).map(c => ({
        id: c.id,
        color: theme.category[c.id],
        bytes: summaries[c.id].reclaimableBytes,
      })),
    [theme, summaries],
  );

  const totalItems = CATEGORIES.reduce((sum, c) => sum + summaries[c.id].itemCount, 0);

  const capacityBytes =
    deviceStorage.status === 'ready' ? deviceStorage.storage.totalBytes : undefined;

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="title">ClrUp</Text>
          <Text variant="body" color="textDim">
            {pluralize(totalItems, 'item')} worth reviewing
          </Text>
        </View>

        <PermissionsSection />

        <View style={styles.ringWrap}>
          <StorageRing segments={segments} capacityBytes={capacityBytes} size={200} strokeWidth={16} />
          {deviceStorage.status === 'ready' ? (
            <Text variant="caption" color="textDim" align="center" style={styles.capacityCaption}>
              {`${formatBytesText(deviceStorage.storage.freeBytes)} free of ${formatBytesText(
                deviceStorage.storage.totalBytes,
              )}`}
              {deviceStorage.storage.isSimulator ? ' · Simulator disk, not a phone' : ''}
            </Text>
          ) : null}
        </View>

        {CATEGORIES.map(category => {
          const summary = summaries[category.id];
          const pending =
            (scanPending && (category.id === 'screenshots' || category.id === 'largeVideos')) ||
            (similarPending && category.id === 'similarPhotos') ||
            (contactsPending && category.id === 'duplicateContacts');
          return (
            <CategoryRow
              key={category.id}
              label={category.label}
              color={theme.category[category.id]}
              pending={pending}
              value={
                pending
                  ? 'Scanning…'
                  : category.measuredInBytes
                    ? formatBytesText(summary.reclaimableBytes)
                    : String(summary.itemCount)
              }
              onPress={() => navigation.navigate(category.route as never)}
            />
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: theme.spacing.xl }]}>
        {/* Says "Review", never "Delete" — the safety rule lives in the copy too. */}
        <Button
          label="Review & Clean Up"
          onPress={() => navigation.navigate('Review', { from: 'dashboard' })}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: 16 },
  header: { paddingTop: 8, paddingBottom: 4 },
  ringWrap: { alignItems: 'center', paddingVertical: 24 },
  capacityCaption: { marginTop: 12 },
  footer: { paddingTop: 8 },
});
