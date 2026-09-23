import React, { useMemo, useState } from 'react';
import { Image, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Screen, Text, useTheme } from '../../design-system';
import { useThumbnail } from '../../hooks/useThumbnail';
import { formatBytesText, pluralize } from '../../lib/format';
import NativePhotoScanner from '../../native/NativePhotoScanner';
import type { RootStackParamList } from '../../navigation/types';
import { pendingTotalBytes, usePendingDeletionStore, type PendingItem } from '../../stores/usePendingDeletionStore';
import { useScanStore } from '../../stores/useScanStore';
import { useSimilarPhotosStore } from '../../stores/useSimilarPhotosStore';
import { useBlurryPhotosStore } from '../../stores/useBlurryPhotosStore';
import { useAppStatsStore } from '../../stores/useAppStatsStore';
import type { CategoryId } from '../../types/domain';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATEGORY_LABEL: Record<CategoryId, string> = {
  similarPhotos: 'Similar Photos',
  blurryPhotos: 'Blurry Photos',
  screenshots: 'Screenshots',
  largeVideos: 'Large Videos',
  duplicateContacts: 'Duplicate Contacts',
};

// Fixed, predictable order — matches the dashboard's own category order —
// rather than whatever order items happened to be added in.
const CATEGORY_ORDER: CategoryId[] = ['similarPhotos', 'blurryPhotos', 'screenshots', 'largeVideos'];

const ThumbRow: React.FC<{ item: PendingItem; color: string; onRemove: (id: string) => void }> = ({
  item,
  color,
  onRemove,
}) => {
  const theme = useTheme();
  const uri = useThumbnail(item.id, 160);

  return (
    <View style={styles.row}>
      <View style={styles.thumbWrap}>
        {uri ? (
          <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, { backgroundColor: theme.color.border }]} />
        )}
      </View>
      <Text variant="body" style={styles.rowBytes}>
        {formatBytesText(item.bytes)}
      </Text>
      <Pressable
        onPress={() => onRemove(item.id)}
        accessibilityRole="button"
        accessibilityLabel="Remove from review"
        style={[styles.removeButton, { borderColor: color }]}>
        <Text variant="label" color={color}>
          ✕
        </Text>
      </Pressable>
    </View>
  );
};

export const ReviewScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const items = usePendingDeletionStore(s => s.items);
  const removeItem = usePendingDeletionStore(s => s.remove);
  const clearItems = usePendingDeletionStore(s => s.clear);
  const rescanLibrary = useScanStore(s => s.scan);
  const rescanSimilar = useSimilarPhotosStore(s => s.scan);
  const rescanBlurry = useBlurryPhotosStore(s => s.scan);
  const addLifetimeFreed = useAppStatsStore(s => s.add);
  const [deleting, setDeleting] = useState(false);

  const sections = useMemo(() => {
    const byCategory = new Map<CategoryId, PendingItem[]>();
    for (const item of items.values()) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }
    return CATEGORY_ORDER.filter(id => byCategory.has(id)).map(id => ({
      category: id,
      title: CATEGORY_LABEL[id],
      data: byCategory.get(id)!,
    }));
  }, [items]);

  const totalBytes = useMemo(() => pendingTotalBytes(items), [items]);
  const totalCount = items.size;

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const ids = Array.from(items.keys());
      const deletedCount = await NativePhotoScanner.deleteAssets(ids);
      if (deletedCount > 0) {
        // A single batch delete is all-or-nothing (Apple's own confirmation
        // sheet covers the whole request), so the precomputed total is the
        // real freed amount, not an estimate.
        clearItems();
        rescanLibrary();
        rescanSimilar();
        rescanBlurry();
        const lifetimeFreedBytes = await addLifetimeFreed(totalBytes);
        navigation.replace('Result', { freedBytes: totalBytes, itemCount: totalCount, lifetimeFreedBytes });
      }
      // deletedCount === 0 means the user cancelled the system sheet — the
      // cart stays exactly as it was, nothing to report.
    } finally {
      setDeleting(false);
    }
  };

  if (totalCount === 0) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="headline" align="center">
            Nothing to review yet
          </Text>
          <Text variant="body" color="textDim" align="center" style={styles.emptyBody}>
            Select items from Similar Photos, Screenshots, or Large Videos and add them here before deleting
            anything.
          </Text>
          <View style={styles.emptyButton}>
            <Button label="Back to Dashboard" variant="secondary" onPress={() => navigation.navigate('Dashboard')} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: theme.color.background }]}>
            <View style={[styles.dot, { backgroundColor: theme.category[section.category] }]} />
            <Text variant="label" style={styles.sectionTitle}>
              {section.title}
            </Text>
            <Text variant="caption" color="textDim">
              {pluralize(section.data.length, 'item')}
            </Text>
          </View>
        )}
        renderItem={({ item, section }) => (
          <ThumbRow item={item} color={theme.category[section.category]} onRemove={removeItem} />
        )}
        ListHeaderComponent={
          <Text variant="body" color="textDim" style={styles.listIntro}>
            Nothing below is deleted until you confirm.
          </Text>
        }
      />

      <View
        style={[
          styles.footer,
          { paddingBottom: theme.spacing.xl, borderTopColor: theme.color.border },
        ]}>
        <Button
          label={`Delete ${totalCount} ${totalCount === 1 ? 'Item' : 'Items'}`}
          detail={formatBytesText(totalBytes)}
          variant="danger"
          loading={deleting}
          onPress={confirmDelete}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyBody: { marginTop: 8, maxWidth: 300 },
  emptyButton: { marginTop: 20, minWidth: 200 },
  listIntro: { paddingVertical: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  dot: { width: 9, height: 9, borderRadius: 999, marginRight: 8 },
  sectionTitle: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  thumbWrap: { width: 56, height: 56, marginRight: 12 },
  thumb: { width: '100%', height: '100%', borderRadius: 8 },
  rowBytes: { flex: 1 },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
});
