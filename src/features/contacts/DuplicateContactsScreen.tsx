import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Screen, Text, useTheme } from '../../design-system';
import { pluralize } from '../../lib/format';
import NativeContactsDuplicates, {
  type ContactDuplicateGroup,
  type ContactSummary,
} from '../../native/NativeContactsDuplicates';
import { useContactsStore } from '../../stores/useContactsStore';

const matchLabel = (reasons: string[]): string => {
  if (reasons.includes('phone') && reasons.includes('email')) return 'Same phone & email';
  if (reasons.includes('phone')) return 'Same phone number';
  if (reasons.includes('email')) return 'Same email address';
  return 'Similar name';
};

/** Contact with the most filled-in fields — a reasonable default "keeper" before the user overrides it. */
const mostCompleteId = (contacts: ContactSummary[]): string =>
  contacts.reduce((best, c) =>
    c.phones.length + c.emails.length > best.phones.length + best.emails.length ? c : best,
  ).id;

const ContactRow: React.FC<{
  contact: ContactSummary;
  isKeeper: boolean;
  color: string;
  onTap: () => void;
}> = ({ contact, isKeeper, color, onTap }) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onTap}
      accessibilityRole="button"
      accessibilityLabel={`${contact.displayName}${isKeeper ? ', keep this one' : ''}`}
      style={[styles.contactRow, { borderColor: isKeeper ? color : theme.color.border }]}>
      <View style={styles.contactMeta}>
        <Text variant="label">{contact.displayName}</Text>
        {contact.phones[0] ? (
          <Text variant="caption" color="textDim" style={styles.contactLine}>
            {contact.phones[0]}
          </Text>
        ) : null}
        {contact.emails[0] ? (
          <Text variant="caption" color="textDim" style={styles.contactLine}>
            {contact.emails[0]}
          </Text>
        ) : null}
      </View>
      <View style={[styles.keeperBadge, { borderColor: color }, isKeeper && { backgroundColor: color }]}>
        <Text variant="caption" color={isKeeper ? theme.color.textOnAccent : color}>
          KEEP
        </Text>
      </View>
    </Pressable>
  );
};

const GroupCard: React.FC<{
  group: ContactDuplicateGroup;
  keeperId: string;
  onSetKeeper: (contactId: string) => void;
  onResolved: () => void;
}> = ({ group, keeperId, onSetKeeper, onResolved }) => {
  const theme = useTheme();
  const [busy, setBusy] = useState<'merge' | 'delete' | null>(null);
  const others = group.contacts.filter(c => c.id !== keeperId);
  const keeper = group.contacts.find(c => c.id === keeperId) ?? group.contacts[0];

  const confirmMerge = () => {
    Alert.alert(
      'Merge contacts?',
      `"${keeper?.displayName}" will keep every phone number and email from the other ${pluralize(
        others.length,
        'contact',
      )}. ${pluralize(others.length, 'duplicate card')} will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge',
          onPress: async () => {
            setBusy('merge');
            try {
              await NativeContactsDuplicates.mergeContacts(
                keeperId,
                others.map(c => c.id),
              );
              onResolved();
            } catch (err) {
              Alert.alert('Merge failed', err instanceof Error ? err.message : 'Please try again.');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete duplicate contacts?',
      `${pluralize(others.length, 'contact')} will be permanently deleted: ${others
        .map(c => c.displayName)
        .join(', ')}. "${keeper?.displayName}" is kept, unchanged. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            try {
              await NativeContactsDuplicates.deleteContacts(others.map(c => c.id));
              onResolved();
            } catch (err) {
              Alert.alert('Delete failed', err instanceof Error ? err.message : 'Please try again.');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Card style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Text variant="label">{matchLabel(group.matchedOn)}</Text>
        <Text variant="caption" color="textDim">
          {group.confidence === 'low' ? 'Review before merging' : 'High confidence'}
        </Text>
      </View>

      <View style={{ marginTop: theme.spacing.sm }}>
        {group.contacts.map(contact => (
          <ContactRow
            key={contact.id}
            contact={contact}
            isKeeper={contact.id === keeperId}
            color={theme.category.duplicateContacts}
            onTap={() => onSetKeeper(contact.id)}
          />
        ))}
      </View>

      <View style={styles.actionsRow}>
        <View style={styles.actionButton}>
          <Button label="Merge" onPress={confirmMerge} loading={busy === 'merge'} disabled={busy !== null} />
        </View>
        <View style={styles.actionButton}>
          <Button
            label="Delete"
            variant="danger"
            onPress={confirmDelete}
            loading={busy === 'delete'}
            disabled={busy !== null}
          />
        </View>
      </View>
    </Card>
  );
};

export const DuplicateContactsScreen: React.FC = () => {
  const theme = useTheme();
  const { status, groups, scan } = useContactsStore();
  const [keepers, setKeepers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (status === 'idle') scan();
  }, [status, scan]);

  // Fills in a default keeper for any group that doesn't have one yet
  // (newly loaded, or just resolved and re-scanned) — never overwrites a
  // choice the user already made for a group that's still present.
  useEffect(() => {
    setKeepers(prev => {
      let changed = false;
      const next = { ...prev };
      for (const group of groups) {
        if (!next[group.id]) {
          next[group.id] = mostCompleteId(group.contacts);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [groups]);

  const totalExtra = useMemo(
    () => groups.reduce((sum, g) => sum + Math.max(0, g.contacts.length - 1), 0),
    [groups],
  );

  if (status === 'idle' || status === 'scanning') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.accent} />
        </View>
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="body" color="textDim" align="center">
            Couldn't check your contacts. Pull down to try again.
          </Text>
        </View>
      </Screen>
    );
  }

  if (groups.length === 0) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text variant="headline" align="center">
            No duplicate contacts found
          </Text>
          <Text variant="body" color="textDim" align="center" style={styles.emptyBody}>
            Contacts that share a phone number, email, or a very similar name will show up here.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <FlatList
        data={groups}
        keyExtractor={g => g.id}
        ListHeaderComponent={
          <Text variant="body" color="textDim" style={styles.listHeader}>
            {`${pluralize(groups.length, 'group')} · ${pluralize(totalExtra, 'extra card')}`}
          </Text>
        }
        renderItem={({ item }) => (
          <GroupCard
            group={item}
            keeperId={keepers[item.id] ?? item.contacts[0]?.id ?? ''}
            onSetKeeper={contactId => setKeepers(prev => ({ ...prev, [item.id]: contactId }))}
            onResolved={scan}
          />
        )}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyBody: { marginTop: 8, maxWidth: 280 },
  listHeader: { paddingVertical: 10 },
  groupCard: { marginBottom: 12 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  contactMeta: { flex: 1 },
  contactLine: { marginTop: 2 },
  keeperBadge: { borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionButton: { flex: 1 },
});
