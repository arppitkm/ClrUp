import React, { useMemo } from 'react';
import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '../theme';
import type { TypographyVariant } from '../tokens';

type Props = RNTextProps & {
  variant?: TypographyVariant;
  /** Semantic colour role, or any explicit colour string. */
  color?: 'text' | 'textDim' | 'accent' | 'danger' | 'textOnAccent' | (string & {});
  align?: 'left' | 'center' | 'right';
  /** Forces UPPERCASE. Pairs with the `caption` variant's wider tracking. */
  uppercase?: boolean;
};

/**
 * The only text primitive. Components never reach for RN's `Text` directly,
 * which is what keeps the type scale honest.
 */
export const Text: React.FC<Props> = ({
  variant = 'body',
  color = 'text',
  align,
  uppercase,
  style,
  ...rest
}) => {
  const theme = useTheme();

  const resolved = useMemo(() => {
    const spec = theme.typography[variant];
    const roleColor = (theme.color as Record<string, string>)[color] ?? color;

    return StyleSheet.flatten([
      {
        fontSize: spec.fontSize,
        fontWeight: spec.fontWeight,
        letterSpacing: spec.letterSpacing,
        color: roleColor,
      },
      // Monospaced digits keep counts from jittering as a scan streams in.
      spec.tabular ? { fontVariant: ['tabular-nums' as const] } : null,
      align ? { textAlign: align } : null,
      uppercase ? { textTransform: 'uppercase' as const } : null,
    ]);
  }, [theme, variant, color, align, uppercase]);

  return <RNText {...rest} style={[resolved, style]} />;
};
