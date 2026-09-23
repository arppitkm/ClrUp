import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Screen, SelectionBadge, Text, useTheme } from '../../design-system';
import { useThumbnail } from '../../hooks/useThumbnail';
import { formatBytesText, formatDuration, pluralize } from '../../lib/format';
import type { RootStackParamList } from '../../navigation/types';
import NativePhotoScanner, { type VideoAsset } from '../../native/NativePhotoScanner';
import { usePendingDeletionStore } from '../../stores/usePendingDeletionStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type LoadState = 'loading' | 'ready' | 'error';

const THUMB_SIZE = 84;
// Sanity cap: even a very large library rarely has more space-relevant
// videos than this, and it keeps the list from paging in forever.
const MAX_VIDEOS = 300;

const Row: React.FC<{
  asset: VideoAsset;
  selected: boolean;
  onToggle: (id: string) => void;
}> = ({ asset, selected, onToggle }) => {
  const theme = useTheme();
  const uri = useThumbnail(asset.id, THUMB_SIZE * 2);

  return (
    <Pressable
      onPress={() => onToggle(asset.id)}
      accessibilityRole="button"
      accessibilityLabel={`Video, ${formatDuration(asset.durationSeconds)}, ${formatBytesText(asset.bytes)}`}
      accessibilityState={{ selected }}
      style={[
        styles.row,
        {
          backgroundColor: theme.color.surface,
          borderRadius: theme.radius.md,
          marginBottom: theme.spacing.sm,
          padding: theme.spacing.sm,
        },
      ]}>
      <View style={styles.thumbWrap}>
        {uri ? (
          <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, { backgroundColor: theme.color.border }]} />
        )}
        <View style={styles.durationBadge}>
          <Text variant="caption" color="#FFFFFF">
            {formatDuration(asset.durationSeconds)}
          </Text>
        </View>
      </View>

      <View style={styles.meta}>
        <Text variant="label">{formatBytesText(asset.bytes)}</Text>
        <Text variant="caption" color="textDim" style={styles.dimensions}>
          {`${asset.widthPx}×${asset.heightPx}`}
        </Text>
      </View>

      <SelectionBadge selected={selected} color={theme.category.largeVideos} />
    </Pressable>
  );
};

export const LargeVideosScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const addToPending = usePendingDeletionStore(s => s.add);
  const [state, setState] = useState<LoadState>('loading');
  const [assets, setAssets] = useState<VideoAsset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    NativePhotoScanner.listLargeVideos(MAX_VIDEOS)
      .then(result => {
        if (cancelled) return;
        setAssets(result);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedBytes = useMemo(
    () => assets.filter(a => selected.has(a.id)).reduce((sum, a) => sum + a.bytes, 0),
    [assets, selected],
  );

  if (state === 'loading') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.accent} />
        </View>
      </Screen>
    );
  }

  if (state === 'error') {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="body" color="textDim" align="center">
            Couldn't read your videos. Pull down to try again.
          </Text>
        </View>
      </Screen>
    );
  }

  if (assets.length === 0) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="headline" align="center">
            No large videos found
          </Text>
          <Text variant="body" color="textDim" align="center" style={styles.emptyBody}>
            Videos taking up meaningful space will show up here, largest first.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <FlatList
        data={assets}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <Text variant="body" color="textDim" style={styles.listHeader}>
            {`${pluralize(assets.length, 'video')}, largest first`}
          </Text>
        }
        renderItem={({ item }) => (
          <Row asset={item} selected={selected.has(item.id)} onToggle={toggle} />
        )}
      />

      {selected.size > 0 ? (
        <View style={[styles.footer, { paddingBottom: theme.spacing.xl, borderTopColor: theme.color.border }]}>
          <Button
            label="Add to Review"
            detail={`${pluralize(selected.size, 'video')} · ${formatBytesText(selectedBytes)}`}
            onPress={() => {
              addToPending(
                assets
                  .filter(a => selected.has(a.id))
                  .map(a => ({ id: a.id, category: 'largeVideos' as const, bytes: a.bytes })),
              );
              navigation.navigate('Review', { from: 'largeVideos' });
            }}
          />
        </View>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyBody: { marginTop: 8, maxWidth: 280 },
  listHeader: { paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumbWrap: { width: THUMB_SIZE, height: THUMB_SIZE, marginRight: 12 },
  thumb: { width: '100%', height: '100%', borderRadius: 8 },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  meta: { flex: 1 },
  dimensions: { marginTop: 2 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
});
