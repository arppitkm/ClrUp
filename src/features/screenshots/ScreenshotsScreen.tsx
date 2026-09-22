import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'react-native';
import { Button, Screen, SelectionBadge, Text, useTheme } from '../../design-system';
import { useThumbnail } from '../../hooks/useThumbnail';
import { formatBytesText, pluralize } from '../../lib/format';
import NativePhotoScanner, { type ScreenshotAsset } from '../../native/NativePhotoScanner';

const COLUMNS = 3;
const GRID_GAP = 3;

type LoadState = 'loading' | 'ready' | 'error';

const Cell: React.FC<{
  asset: ScreenshotAsset;
  size: number;
  selected: boolean;
  onToggle: (id: string) => void;
}> = ({ asset, size, selected, onToggle }) => {
  const theme = useTheme();
  // 2x the display size so the thumbnail stays crisp on Retina without
  // requesting a needlessly large decode for a ~110pt grid cell.
  const uri = useThumbnail(asset.id, Math.round(size * 2));

  return (
    <Pressable
      onPress={() => onToggle(asset.id)}
      style={{ width: size, height: size, margin: GRID_GAP / 2 }}
      accessibilityRole="button"
      accessibilityLabel="Screenshot"
      accessibilityState={{ selected }}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbnail, styles.placeholder, { backgroundColor: theme.color.border }]} />
      )}
      <View style={[StyleSheet.absoluteFill, selected ? styles.selectedOverlay : null]} />
      <View style={styles.badgeWrap}>
        <SelectionBadge selected={selected} color={theme.category.screenshots} />
      </View>
    </Pressable>
  );
};

export const ScreenshotsScreen: React.FC = () => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const cellSize = (width - theme.spacing.lg * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

  const [state, setState] = useState<LoadState>('loading');
  const [assets, setAssets] = useState<ScreenshotAsset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    NativePhotoScanner.listScreenshots()
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

  const allSelected = assets.length > 0 && selected.size === assets.length;
  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(assets.map(a => a.id)));
  }, [allSelected, assets]);

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
            Couldn't read your screenshots. Pull down to try again.
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
            No screenshots found
          </Text>
          <Text variant="body" color="textDim" align="center" style={styles.emptyBody}>
            When you take screenshots, they'll show up here so you can clear them out in one go.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} padded={false}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.lg }]}>
        <Text variant="body" color="textDim">
          {pluralize(assets.length, 'screenshot')}
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
            detail={`${pluralize(selected.size, 'screenshot')} · ${formatBytesText(selectedBytes)}`}
            onPress={() => {
              // Wired to the shared pending-deletion store once Review (phase
              // 6) lands — selection itself is fully functional today.
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
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
});
