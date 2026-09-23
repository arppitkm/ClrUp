import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card, Screen, SelectionBadge, Text, useTheme } from '../../design-system';
import { useThumbnail } from '../../hooks/useThumbnail';
import { formatBytesText, pluralize } from '../../lib/format';
import type { RootStackParamList } from '../../navigation/types';
import type { SimilarAsset, SimilarGroup } from '../../native/NativeSimilarPhotos';
import { usePendingDeletionStore } from '../../stores/usePendingDeletionStore';
import { useSimilarPhotosStore } from '../../stores/useSimilarPhotosStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const THUMB_SIZE = 118;

/**
 * Only `exact` and `high` confidence groups start pre-selected (minus the
 * keeper). `medium` — genuinely similar but not certain duplicates — is shown
 * with nothing pre-checked: the app is allowed to guess, not to guess on the
 * user's behalf.
 */
const autoSelectableConfidence = (confidence: string): boolean =>
  confidence === 'exact' || confidence === 'high';

const confidenceLabel = (confidence: string): string => {
  switch (confidence) {
    case 'exact':
      return 'Exact duplicates';
    case 'high':
      return 'Near-identical';
    default:
      return 'Similar';
  }
};

const Thumb: React.FC<{
  asset: SimilarAsset;
  selected: boolean;
  color: string;
  onToggle: (id: string) => void;
}> = ({ asset, selected, color, onToggle }) => {
  const theme = useTheme();
  const uri = useThumbnail(asset.id, THUMB_SIZE * 2);

  return (
    <Pressable
      onPress={() => onToggle(asset.id)}
      accessibilityRole="button"
      accessibilityLabel={asset.isBest ? 'Best shot, kept' : 'Similar photo'}
      accessibilityState={{ selected }}
      style={styles.thumbWrap}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, { backgroundColor: theme.color.border }]} />
      )}
      <View style={[StyleSheet.absoluteFill, selected ? styles.selectedOverlay : null, styles.thumbRadius]} />
      {asset.isBest ? (
        <View style={[styles.bestBadge, { backgroundColor: theme.color.accent }]}>
          <Text variant="caption" color={theme.color.textOnAccent}>
            BEST
          </Text>
        </View>
      ) : null}
      <View style={styles.badgeWrap}>
        <SelectionBadge selected={selected} color={color} />
      </View>
    </Pressable>
  );
};

const GroupCard: React.FC<{
  group: SimilarGroup;
  selected: Set<string>;
  onToggle: (id: string) => void;
  color: string;
}> = ({ group, selected, onToggle, color }) => {
  const theme = useTheme();
  const selectedInGroup = group.assets.filter(a => selected.has(a.id)).length;

  return (
    <Card style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Text variant="label">{confidenceLabel(group.confidence)}</Text>
        <Text variant="caption" color="textDim">
          {`${selectedInGroup} selected of ${group.assets.length - 1} extra · ${formatBytesText(
            group.reclaimableBytes,
          )} to free`}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: theme.spacing.sm }}>
        {group.assets.map(asset => (
          <Thumb key={asset.id} asset={asset} selected={selected.has(asset.id)} color={color} onToggle={onToggle} />
        ))}
      </ScrollView>
    </Card>
  );
};

export const SimilarPhotosScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const addToPending = usePendingDeletionStore(s => s.add);
  const { status, groups, scan } = useSimilarPhotosStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (status === 'idle') scan();
  }, [status, scan]);

  // Seed selection once, the first time groups arrive — respects each
  // group's confidence and never touches the keeper. Re-running this on
  // every render would stomp on the user's own choices.
  useEffect(() => {
    if (initialized || status !== 'ready') return;
    const initial = new Set<string>();
    for (const group of groups) {
      if (!autoSelectableConfidence(group.confidence)) continue;
      for (const asset of group.assets) {
        if (!asset.isBest) initial.add(asset.id);
      }
    }
    setSelected(initial);
    setInitialized(true);
  }, [initialized, status, groups]);

  const toggle = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const assetById = useMemo(() => {
    const byId = new Map<string, SimilarAsset>();
    for (const group of groups) for (const asset of group.assets) byId.set(asset.id, asset);
    return byId;
  }, [groups]);

  const selectedBytes = useMemo(() => {
    let total = 0;
    for (const id of selected) total += assetById.get(id)?.bytes ?? 0;
    return total;
  }, [assetById, selected]);

  if (status === 'idle' || status === 'scanning') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.accent} />
          <Text variant="body" color="textDim" align="center" style={styles.scanningNote}>
            Comparing photos on this device…
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
            Couldn't scan for similar photos. Pull down to try again.
          </Text>
        </View>
      </Screen>
    );
  }

  if (groups.length === 0) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="headline" align="center">
            No similar photos found
          </Text>
          <Text variant="body" color="textDim" align="center" style={styles.emptyBody}>
            Bursts and near-identical shots will show up here, grouped together with the sharpest one kept.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <FlatList
        data={groups}
        keyExtractor={g => g.id}
        ListHeaderComponent={
          <Text variant="body" color="textDim" style={styles.listHeader}>
            {pluralize(groups.length, 'group')}
          </Text>
        }
        renderItem={({ item }) => (
          <GroupCard group={item} selected={selected} onToggle={toggle} color={theme.category.similarPhotos} />
        )}
      />

      {selected.size > 0 ? (
        <View style={[styles.footer, { paddingBottom: theme.spacing.xl, borderTopColor: theme.color.border }]}>
          <Button
            label="Add to Review"
            detail={`${pluralize(selected.size, 'photo')} · ${formatBytesText(selectedBytes)}`}
            onPress={() => {
              const items = Array.from(selected, id => ({
                id,
                category: 'similarPhotos' as const,
                bytes: assetById.get(id)?.bytes ?? 0,
              }));
              addToPending(items);
              navigation.navigate('Review', { from: 'similarPhotos' });
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
  listHeader: { paddingVertical: 10 },
  groupCard: { marginBottom: 12 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  thumbWrap: { width: THUMB_SIZE, height: THUMB_SIZE, marginRight: 8 },
  thumb: { width: '100%', height: '100%', borderRadius: 8 },
  thumbRadius: { borderRadius: 8 },
  selectedOverlay: { backgroundColor: 'rgba(20,200,160,0.28)' },
  bestBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeWrap: { position: 'absolute', top: 6, right: 6 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
});
