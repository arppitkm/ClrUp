import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Screen, Text } from '../../design-system';
import { formatBytesText, pluralize } from '../../lib/format';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ResultRoute = RouteProp<RootStackParamList, 'Result'>;

/** The payoff screen — shown once, right after a real deletion actually completed. */
export const ResultScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { freedBytes, itemCount, lifetimeFreedBytes } = useRoute<ResultRoute>().params;

  return (
    <Screen>
      <View style={styles.center}>
        <Text variant="display" color="accent" align="center">
          {formatBytesText(freedBytes)}
        </Text>
        <Text variant="title" align="center" style={styles.freed}>
          freed up
        </Text>
        <Text variant="body" color="textDim" align="center" style={styles.detail}>
          {pluralize(itemCount, 'item')} removed from your library.
        </Text>
        <Text variant="caption" color="textDim" align="center" style={styles.lifetime}>
          {`${formatBytesText(lifetimeFreedBytes)} freed with ClrUp in total`}
        </Text>
      </View>

      <View style={styles.footer}>
        <Button
          label="Done"
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  freed: { marginTop: 4 },
  detail: { marginTop: 12, maxWidth: 280 },
  lifetime: { marginTop: 20 },
  footer: { paddingBottom: 32 },
});
