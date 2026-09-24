import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Screen, SelectionBadge, Text, useTheme } from '../../design-system';
import { useThumbnail } from '../../hooks/useThumbnail';
import { formatBytesText, pluralize } from '../../lib/format';
import type { RootStackParamList } from '../../navigation/types';
import type { BlurryAsset } from '../../native/NativeBlurryPhotos';
import { usePendingDeletionStore } from '../../stores/usePendingDeletionStore';
import { useBlurryPhotosStore } from '../../stores/useBlurryPhotosStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const COLUMNS = 3;
const GRID_GAP = 3;

const Cell: React.FC<{
  asset: BlurryAsset;
  size: number;
  selected: boolean;
  onToggle: (id: string) => void;
}> = ({ asset, size, selected, onToggle }) => {
  const theme = useTheme();
  const uri = useThumbnail(asset.id, Math.round(size * 2));

  return (
    <Pressable
      onPress={() => onToggle(asset.id)}
      style={{ width: size, height: size, margin: GRID_GAP / 2 }}
      accessibilityRole="button"
      accessibilityLabel="Blurry photo"
      accessibilityState={{ selected }}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbnail, styles.placeholder, { backgroundColor: theme.color.border }]} />
      )}
      <View style={[StyleSheet.absoluteFill, selected ? styles.selectedOverlay : null]} />
      <View style={styles.badgeWrap}>
        <SelectionBadge selected={selected} color={theme.category.blurryPhotos} />
      </View>
      {/* TEMPORARY: real on-device sharpness score, for threshold calibration. Remove once tuned. */}
      <View style={styles.scoreWrap}>
        <Text variant="caption" color="#FFFFFF">
          {typeof asset.sharpnessScore === 'number' ? asset.sharpnessScore.toFixed(3) : String(asset.sharpnessScore)}
        </Text>
      </View>
    </Pressable>
  );
};

export const BlurryPhotosScreen: React.FC = () => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const cellSize = (width - theme.spacing.lg * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

  const navigation = useNavigation<Nav>();
  const addToPending = usePendingDeletionStore(s => s.add);
  const { status, assets, scan } = useBlurryPhotosStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === 'idle') scan();
  }, [status, scan]);

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = assets.length > 0 && selected.size === assets.length;
  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(assets.map(a => a.id)));
  }, [allSelected, assets]);

  const selectedBytes = useMemo(
    () => assets.filter(a => selected.has(a.id)).reduce((sum, a) => sum + a.bytes, 0),
    [assets, selected],
  );

  if (status === 'idle' || status === 'scanning') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.accent} />
          <Text variant="body" color="textDim" align="center" style={styles.scanningNote}>
            Checking focus across your photos…
          </Text>
        </View>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="body" color="textDim" align="center">
            Couldn't scan for blurry photos. Pull down to try again.
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
            No blurry photos found
          </Text>
          <Text variant="body" color="textDim" align="center" style={styles.emptyBody}>
            Out-of-focus and motion-blurred shots will show up here.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} padded={false}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.lg }]}>
        <Text variant="body" color="textDim">
          {pluralize(assets.length, 'photo')}
        </Text>
        <Pressable onPress={toggleAll} accessibilityRole="button">
          <Text variant="label" color="accent">
            {allSelected ? 'Deselect All' : 'Select All'}
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={assets}
        numColumns={COLUMNS}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.lg - GRID_GAP / 2 }}
        renderItem={({ item }) => (
          <Cell asset={item} size={cellSize} selected={selected.has(item.id)} onToggle={toggle} />
        )}
      />

      {selected.size > 0 ? (
        <View
          style={[
            styles.footer,
            { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl, borderTopColor: theme.color.border },
          ]}>
          <Button
            label="Add to Review"
            detail={`${pluralize(selected.size, 'photo')} · ${formatBytesText(selectedBytes)}`}
            onPress={() => {
              addToPending(
                assets
                  .filter(a => selected.has(a.id))
                  .map(a => ({ id: a.id, category: 'blurryPhotos' as const, bytes: a.bytes })),
              );
              navigation.navigate('Review', { from: 'blurryPhotos' });
            }}
          />
        </View>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  scanningNote: { marginTop: 12 },
  emptyBody: { marginTop: 8, maxWidth: 280 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  thumbnail: { width: '100%', height: '100%', borderRadius: 6 },
  placeholder: { borderRadius: 6 },
  selectedOverlay: { backgroundColor: 'rgba(20,200,160,0.28)', borderRadius: 6 },
  badgeWrap: { position: 'absolute', top: 6, right: 6 },
  scoreWrap: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
});
