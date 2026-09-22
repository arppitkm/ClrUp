import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Secondary line under the label, e.g. "Frees 4.2 GB". */
  detail?: string;
  accessibilityHint?: string;
};

/**
 * `danger` is deliberately available but used in exactly one place: the final
 * delete confirmation. Every other destructive-looking affordance in the app is
 * a `primary` that says "Review".
 */
export const Button: React.FC<Props> = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  detail,
  accessibilityHint,
}) => {
  const theme = useTheme();
  const inert = disabled || loading;

  const surface = (pressed: boolean): string => {
    switch (variant) {
      case 'primary':
        return pressed ? theme.color.accentPressed : theme.color.accent;
      case 'danger':
        return theme.color.danger;
      case 'secondary':
        return theme.color.surface;
      case 'ghost':
        return 'transparent';
    }
  };

  const labelColor =
    variant === 'primary' ? 'textOnAccent' : variant === 'danger' ? '#FFFFFF' : 'text';

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inert, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: surface(pressed),
          borderRadius: theme.radius.md,
          paddingVertical: theme.spacing.md + 2,
          paddingHorizontal: theme.spacing.lg,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          borderColor: theme.color.border,
          opacity: inert ? 0.45 : 1,
        },
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.color.textOnAccent : theme.color.accent} />
      ) : (
        <View style={styles.stack}>
          <Text variant="label" color={labelColor} align="center">
            {label}
          </Text>
          {detail ? (
            <Text
              variant="caption"
              color={labelColor}
              align="center"
              style={styles.detail}>
              {detail}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  stack: { alignItems: 'center' },
  detail: { marginTop: 2, opacity: 0.75 },
});
