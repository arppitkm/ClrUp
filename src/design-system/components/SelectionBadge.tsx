import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

type Props = {
  selected: boolean;
  /** Category accent, so the badge matches the screen it's on (blue for photos, amber for videos, ...). */
  color: string;
};

/** Small checkmark circle used on every selectable thumbnail across the app. */
export const SelectionBadge: React.FC<Props> = ({ selected, color }) => {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: selected ? color : 'rgba(0,0,0,0.35)',
          borderColor: selected ? color : 'rgba(255,255,255,0.85)',
        },
      ]}>
      {selected ? (
        <Text variant="label" color={theme.color.textOnAccent} style={styles.check}>
          ✓
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { fontSize: 12, lineHeight: 14 },
});
