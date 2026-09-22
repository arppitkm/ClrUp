import React from 'react';
import { StatusBar, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

type Props = ViewProps & {
  /** Which safe-area insets to apply. Screens with a pinned footer drop 'bottom'. */
  edges?: readonly Edge[];
  padded?: boolean;
};

/** Root container for every screen: background colour, safe area, status bar. */
export const Screen: React.FC<Props> = ({
  edges = ['top', 'bottom'],
  padded = true,
  style,
  children,
  ...rest
}) => {
  const theme = useTheme();

  return (
    <SafeAreaView edges={edges} style={[styles.fill, { backgroundColor: theme.color.background }]}>
      <StatusBar barStyle={theme.scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <View
        {...rest}
        style={[styles.fill, padded && { paddingHorizontal: theme.spacing.lg }, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({ fill: { flex: 1 } });
