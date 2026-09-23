import React, { useRef, useState } from 'react';
import { Animated, Dimensions, Image, PanResponder, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Screen, Text, useTheme } from '../../design-system';
import { useThumbnail } from '../../hooks/useThumbnail';
import { formatBytesText, pluralize } from '../../lib/format';
import type { RootStackParamList } from '../../navigation/types';
import { usePendingDeletionStore } from '../../stores/usePendingDeletionStore';
import { useSimilarPhotosStore } from '../../stores/useSimilarPhotosStore';
import { useBlurryPhotosStore } from '../../stores/useBlurryPhotosStore';
import type { CategoryId } from '../../types/domain';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type SwipeCandidate = { id: string; bytes: number; category: CategoryId };

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;
const CARD_WIDTH = SCREEN_WIDTH - 64;
const CARD_HEIGHT = CARD_WIDTH * 1.2;

/**
 * The photos worth a second look: every non-best asset from a Similar Photos
 * group, plus every flagged Blurry Photo — the two candidate-quality signals
 * the app already computes. Read once via `getState()` rather than the hooks,
 * since this list should stay stable for the length of a swipe session even
 * if a background rescan happens to land mid-session. Already-pending items
 * are excluded — this screen is for photos nobody has decided about yet.
 */
const buildCandidates = (): SwipeCandidate[] => {
  const pending = usePendingDeletionStore.getState().items;
  const seen = new Set<string>();
  const list: SwipeCandidate[] = [];

  for (const group of useSimilarPhotosStore.getState().groups) {
    for (const asset of group.assets) {
      if (asset.isBest || seen.has(asset.id) || pending.has(asset.id)) continue;
      seen.add(asset.id);
      list.push({ id: asset.id, bytes: asset.bytes, category: 'similarPhotos' });
    }
  }
  for (const asset of useBlurryPhotosStore.getState().assets) {
    if (seen.has(asset.id) || pending.has(asset.id)) continue;
    seen.add(asset.id);
    list.push({ id: asset.id, bytes: asset.bytes, category: 'blurryPhotos' });
  }
  return list;
};

const CardImage: React.FC<{ id: string }> = ({ id }) => {
  const theme = useTheme();
  const uri = useThumbnail(id, Math.round(CARD_WIDTH * 2));
  return uri ? (
    <Image source={{ uri }} style={styles.cardImage} resizeMode="cover" />
  ) : (
    <View style={[styles.cardImage, { backgroundColor: theme.color.border }]} />
  );
};

export const SwipeCleanupScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const addToPending = usePendingDeletionStore(s => s.add);

  const [candidates] = useState<SwipeCandidate[]>(buildCandidates);
  const [index, setIndex] = useState(0);
  const [markedCount, setMarkedCount] = useState(0);
  const [markedBytes, setMarkedBytes] = useState(0);

  const pan = useRef(new Animated.ValueXY()).current;

  const decide = (direction: 'left' | 'right') => {
    const candidate = candidates[index];
    if (direction === 'left' && candidate) {
      addToPending([{ id: candidate.id, category: candidate.category, bytes: candidate.bytes }]);
      setMarkedCount(c => c + 1);
      setMarkedBytes(b => b + candidate.bytes);
    }
    pan.setValue({ x: 0, y: 0 });
    setIndex(i => i + 1);
  };

  const completeSwipe = (direction: 'left' | 'right') => {
    Animated.timing(pan, {
      toValue: { x: direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5, y: 0 },
      duration: 220,
      useNativeDriver: false,
    }).start(() => decide(direction));
  };

  const resetPosition = () => {
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: false }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) completeSwipe('right');
        else if (g.dx < -SWIPE_THRESHOLD) completeSwipe('left');
        else resetPosition();
      },
    }),
  ).current;

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-18deg', '0deg', '18deg'],
  });
  const keepOpacity = pan.x.interpolate({ inputRange: [0, 30, 140], outputRange: [0, 0, 1], extrapolate: 'clamp' });
  const deleteOpacity = pan.x.interpolate({
    inputRange: [-140, -30, 0],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });

  const current = candidates[index];
  const next = candidates[index + 1];
  const done = index >= candidates.length;

  if (candidates.length === 0 || done || !current) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="headline" align="center">
            {candidates.length === 0 ? 'Nothing left to swipe through' : 'All caught up'}
          </Text>
          <Text variant="body" color="textDim" align="center" style={styles.emptyBody}>
            {candidates.length === 0
              ? 'Similar and blurry photos will show up here once a scan finds some.'
              : `Reviewed ${pluralize(candidates.length, 'photo')} · marked ${pluralize(markedCount, 'photo')} for deletion${
                  markedCount > 0 ? ` · ${formatBytesText(markedBytes)} to free` : ''
                }.`}
          </Text>
        </View>
        <View style={styles.footer}>
          {markedCount > 0 ? (
            <Button label="Go to Review" onPress={() => navigation.navigate('Review', { from: 'dashboard' })} />
          ) : (
            <Button label="Done" onPress={() => navigation.navigate('Dashboard')} />
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Text variant="body" color="textDim" align="center" style={styles.progress}>
        {`${index + 1} of ${candidates.length}${markedCount > 0 ? ` · ${formatBytesText(markedBytes)} marked` : ''}`}
      </Text>

      <View style={styles.deck}>
        {next ? (
          <View style={[styles.card, styles.cardBehind, { backgroundColor: theme.color.surface }]}>
            <CardImage id={next.id} />
          </View>
        ) : null}

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.card,
            { backgroundColor: theme.color.surface },
            { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] },
          ]}>
          <CardImage id={current.id} />
          <Animated.View style={[styles.stamp, styles.keepStamp, { opacity: keepOpacity, borderColor: theme.color.accent }]}>
            <Text variant="headline" color="accent">
              KEEP
            </Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.deleteStamp, { opacity: deleteOpacity, borderColor: theme.color.danger }]}>
            <Text variant="headline" color="danger">
              DELETE
            </Text>
          </Animated.View>
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <View style={styles.actionButton}>
          <Button label="Keep" variant="secondary" onPress={() => completeSwipe('right')} />
        </View>
        <View style={styles.actionGap} />
        <View style={styles.actionButton}>
          <Button label="Delete" variant="danger" onPress={() => completeSwipe('left')} />
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyBody: { marginTop: 8, maxWidth: 300 },
  progress: { paddingVertical: 10 },
  deck: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardBehind: { transform: [{ scale: 0.95 }], opacity: 0.6 },
  cardImage: { width: '100%', height: '100%' },
  stamp: {
    position: 'absolute',
    top: 20,
    borderWidth: 3,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  keepStamp: { left: 20, transform: [{ rotate: '-12deg' }] },
  deleteStamp: { right: 20, transform: [{ rotate: '12deg' }] },
  actions: { flexDirection: 'row', paddingBottom: 24, paddingTop: 8 },
  actionButton: { flex: 1 },
  actionGap: { width: 16 },
  footer: { paddingBottom: 32 },
});
