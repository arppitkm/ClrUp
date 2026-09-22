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
 * Similar Photos and Duplicate Contacts still have no native scanner (Vision
 * similarity and Contacts land in later phases) — these two stay placeholder
 * until then. Screenshots and Large Videos below are replaced with the real
 * scan the moment it completes.
 */
const PLACEHOLDER: Record<CategoryId, CategorySummary> = {
  similarPhotos: { id: 'similarPhotos', itemCount: 248, reclaimableBytes: 4_200_000_000 },
  screenshots: { id: 'screenshots', itemCount: 0, reclaimableBytes: 0 },
  largeVideos: { id: 'largeVideos', itemCount: 0, reclaimableBytes: 0 },
  duplicateContacts: { id: 'duplicateContacts', itemCount: 37, reclaimableBytes: 0 },
};

export const DashboardScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const deviceStorage = useDeviceStorage();
  const permissions = usePermissions();
  const scan = useScanStore();
  // Selected separately so the effect below depends on a stable function
  // reference rather than the whole store object, which changes identity on
  // every status/summary update.
  const runScan = useScanStore(s => s.scan);

  // A scan needs at least some Photos access; `.limited` still lets us scan
  // whatever the user has granted. Runs once per permission grant, not on
  // every render — the store itself guards against overlapping scans.
  useEffect(() => {
    if (permissions.photos === 'authorized' || permissions.photos === 'limited') {
      runScan();
    }
  }, [permissions.photos, runScan]);

  // Only show a category row as "pending" once a scan has actually been
  // requested — before Photos access is granted, `idle` just means nothing
  // has been asked for yet, not that a scan is running.
  const scanPending = scan.status === 'scanning';

  const summaries = useMemo<Record<CategoryId, CategorySummary>>(() => {
    if (scan.status !== 'ready' || !scan.summary) return PLACEHOLDER;
    return {
      ...PLACEHOLDER,
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
  }, [scan.status, scan.summary]);

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
          const pending = scanPending && (category.id === 'screenshots' || category.id === 'largeVideos');
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
