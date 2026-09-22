import React, { useMemo } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme, type Theme as NavTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../design-system';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { SimilarPhotosScreen } from '../features/photos/SimilarPhotosScreen';
import { ScreenshotsScreen } from '../features/screenshots/ScreenshotsScreen';
import { LargeVideosScreen } from '../features/videos/LargeVideosScreen';
import { DuplicateContactsScreen } from '../features/contacts/DuplicateContactsScreen';
import { ReviewScreen } from '../features/review/ReviewScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const theme = useTheme();

  // Hand our tokens to React Navigation so its chrome matches the app.
  const navTheme = useMemo<NavTheme>(() => {
    const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.color.accent,
        background: theme.color.background,
        card: theme.color.background,
        text: theme.color.text,
        border: theme.color.border,
      },
    };
  }, [theme]);

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: theme.color.accent,
          headerTitleStyle: { color: theme.color.text },
          contentStyle: { backgroundColor: theme.color.background },
        }}>
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SimilarPhotos" component={SimilarPhotosScreen} options={{ title: 'Similar Photos' }} />
        <Stack.Screen name="Screenshots" component={ScreenshotsScreen} options={{ title: 'Screenshots' }} />
        <Stack.Screen name="LargeVideos" component={LargeVideosScreen} options={{ title: 'Large Videos' }} />
        <Stack.Screen name="DuplicateContacts" component={DuplicateContactsScreen} options={{ title: 'Duplicate Contacts' }} />
        <Stack.Screen name="Review" component={ReviewScreen} options={{ title: 'Review' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
