import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../theme';

type Props = ViewProps & { padded?: boolean };

/** Raised surface with the standard corner radius and a true hairline border. */
export const Card: React.FC<Props> = ({ padded = true, style, children, ...rest }) => {
  const theme = useTheme();

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: theme.color.surface,
          borderRadius: theme.radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.color.border,
          padding: padded ? theme.spacing.lg : 0,
        },
        style,
      ]}>
      {children}
    </View>
  );
};
