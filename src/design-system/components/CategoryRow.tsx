import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

type Props = {
  label: string;
  /** Right-hand figure: "4.2 GB", "37", or a status string while scanning. */
  value: string;
  /** The category's accent, matching its segment in the dashboard ring. */
  color: string;
  onPress?: () => void;
  /** Dims the row and blocks the press while its scan is still running. */
  pending?: boolean;
};

/** One cleanable category on the dashboard. */
export const CategoryRow: React.FC<Props> = ({ label, value, color, onPress, pending }) => {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={pending || !onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.color.surface,
          borderRadius: theme.radius.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          marginBottom: theme.spacing.sm,
          opacity: pending ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text variant="label" style={styles.label}>
        {label}
      </Text>
      <Text variant="label" color="accent">
        {value}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 999, marginRight: 10 },
  label: { flex: 1 },
});
