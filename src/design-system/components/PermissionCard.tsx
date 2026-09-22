import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { Card } from './Card';
import { Button } from './Button';
import { Text } from './Text';

type Props = {
  title: string;
  /** The rationale — shown before any system prompt, per the brief's requirement. */
  description: string;
  actionLabel: string;
  onAction: () => void;
  actionLoading?: boolean;
};

/**
 * One reusable shape for every permission state that needs the user's
 * attention: the pre-prompt rationale, the `.limited` follow-up, and the
 * `.denied` recovery path all render through this, just with different copy
 * and action. Keeping one component means the tone stays consistent instead
 * of drifting screen to screen.
 */
export const PermissionCard: React.FC<Props> = ({
  title,
  description,
  actionLabel,
  onAction,
  actionLoading,
}) => {
  const theme = useTheme();

  return (
    <Card style={styles.card}>
      <Text variant="headline">{title}</Text>
      <Text variant="body" color="textDim" style={{ marginTop: theme.spacing.xs }}>
        {description}
      </Text>
      <View style={{ marginTop: theme.spacing.md }}>
        <Button label={actionLabel} onPress={onAction} loading={actionLoading} variant="secondary" />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
});
