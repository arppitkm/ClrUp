import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Screen, Text, useTheme } from '../../design-system';
import { useThumbnail } from '../../hooks/useThumbnail';
import { pluralize } from '../../lib/format';
import NativePrivateVault from '../../native/NativePrivateVault';
import { usePrivateVaultStore } from '../../stores/usePrivateVaultStore';

const COLUMNS = 3;
const GRID_GAP = 3;

const Cell: React.FC<{ id: string; size: number; onRemove: (id: string) => void }> = ({ id, size, onRemove }) => {
  const theme = useTheme();
  const uri = useThumbnail(id, Math.round(size * 2));

  return (
    <View style={{ width: size, height: size, margin: GRID_GAP / 2 }}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbnail, { backgroundColor: theme.color.border }]} />
      )}
      <Pressable
        onPress={() => onRemove(id)}
        accessibilityRole="button"
        accessibilityLabel="Remove from Private Vault"
        style={[styles.removeBadge, { backgroundColor: theme.color.surface, borderColor: theme.color.border }]}>
        <Text variant="caption" color="textDim">
          ✕
        </Text>
      </Pressable>
    </View>
  );
};

/**
 * Re-locks every time this screen loses focus — there is no "stay
 * unlocked" session, so returning here always asks again. That's the
 * simplest rule to reason about and matches how a bank app's PIN gate works.
 */
export const PrivateVaultScreen: React.FC = () => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const cellSize = (width - theme.spacing.lg * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

  const { status, ids, unlocked, load, addIds, removeIds, authenticate, lock } = usePrivateVaultStore();
  const [authenticating, setAuthenticating] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);

  const tryUnlock = useCallback(async () => {
    setAuthenticating(true);
    setAuthFailed(false);
    const success = await authenticate();
    setAuthenticating(false);
    if (!success) setAuthFailed(true);
  }, [authenticate]);

  useFocusEffect(
    useCallback(() => {
      tryUnlock();
      return () => lock();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  useEffect(() => {
    if (unlocked) load();
  }, [unlocked, load]);

  const addPhotos = useCallback(async () => {
    setPickerBusy(true);
    try {
      const picked = await NativePrivateVault.presentAssetPicker();
      if (picked.length > 0) await addIds(picked);
    } catch {
      // User cancelled the picker, or it couldn't be presented — nothing to add either way.
    } finally {
      setPickerBusy(false);
    }
  }, [addIds]);

  if (!unlocked) {
    return (
      <Screen>
        <View style={styles.center}>
          {authenticating ? (
            <>
              <ActivityIndicator color={theme.color.accent} />
              <Text variant="body" color="textDim" align="center" style={styles.lockedNote}>
                Unlocking…
              </Text>
            </>
          ) : (
            <>
              <Text variant="headline" align="center">
                Private Vault is locked
              </Text>
              <Text variant="body" color="textDim" align="center" style={styles.lockedNote}>
                {authFailed
                  ? "Couldn't verify it's you. Try again."
                  : 'Unlock with Face ID or your passcode to view private photos.'}
              </Text>
              <View style={styles.unlockButton}>
                <Button label="Unlock" onPress={tryUnlock} />
              </View>
            </>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} padded={false}>
      <View style={[styles.header, { paddingHorizontal: theme.spacing.lg }]}>
        <Text variant="body" color="textDim">
          {pluralize(ids.length, 'private item')}
        </Text>
        <Button label="Add Photos" variant="secondary" loading={pickerBusy} onPress={addPhotos} />
      </View>

      {status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.color.accent} />
        </View>
      ) : ids.length === 0 ? (
        <View style={styles.center}>
          <Text variant="body" color="textDim" align="center" style={styles.emptyBody}>
            Nothing here yet. Add photos you'd like locked behind Face ID.
          </Text>
        </View>
      ) : (
        <FlatList
          data={ids}
          numColumns={COLUMNS}
          keyExtractor={id => id}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.lg - GRID_GAP / 2, paddingTop: 8 }}
          renderItem={({ item }) => <Cell id={item} size={cellSize} onRemove={id => removeIds([id])} />}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  lockedNote: { marginTop: 8, maxWidth: 280 },
  unlockButton: { marginTop: 20, minWidth: 200 },
  emptyBody: { maxWidth: 280 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  thumbnail: { width: '100%', height: '100%', borderRadius: 8 },
  removeBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
