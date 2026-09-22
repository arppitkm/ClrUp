import React, { useMemo } from 'react';
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
import { formatBytesText, pluralize } from '../../lib/format';
import type { RootStackParamList } from '../../navigation/types';
import type { CategoryId, CategorySummary } from '../../types/domain';

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
 * Placeholder figures so the shell is reviewable before the native scanners
 * land in phase 2. Replaced wholesale by the scan store — no component below
 * this line knows where the numbers come from.
 */
const PLACEHOLDER: Record<CategoryId, CategorySummary> = {
  similarPhotos: { id: 'similarPhotos', itemCount: 248, reclaimableBytes: 4_200_000_000 },
  screenshots: { id: 'screenshots', itemCount: 612, reclaimableBytes: 1_800_000_000 },
  largeVideos: { id: 'largeVideos', itemCount: 23, reclaimableBytes: 6_400_000_000 },
  duplicateContacts: { id: 'duplicateContacts', itemCount: 37, reclaimableBytes: 0 },
};

export const DashboardScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();

  const summaries = PLACEHOLDER;

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

        <View style={styles.ringWrap}>
          <StorageRing segments={segments} size={200} strokeWidth={16} />
        </View>

        {CATEGORIES.map(category => {
          const summary = summaries[category.id];
          return (
            <CategoryRow
              key={category.id}
              label={category.label}
              color={theme.category[category.id]}
              value={
                category.measuredInBytes
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
  footer: { paddingTop: 8 },
});
