import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen, Text } from '../../design-system';

type Props = {
  title: string;
  /** What this screen will do once its phase lands. */
  summary: string;
  /** Which build phase implements it, so the scaffold is self-documenting. */
  phase: string;
};

/**
 * Temporary stand-in for a screen whose native scanner has not landed yet.
 * Every one of these is deleted as its phase completes.
 */
export const PhasePlaceholder: React.FC<Props> = ({ title, summary, phase }) => (
  <Screen>
    <View style={styles.center}>
      <Text variant="title" align="center">
        {title}
      </Text>
      <Text variant="body" color="textDim" align="center" style={styles.summary}>
        {summary}
      </Text>
      <Text variant="caption" color="textDim" uppercase align="center" style={styles.phase}>
        {phase}
      </Text>
    </View>
  </Screen>
);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summary: { marginTop: 8, maxWidth: 280 },
  phase: { marginTop: 20 },
});
