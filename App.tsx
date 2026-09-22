/**
 * ClrUp — find and safely remove what is wasting space on your iPhone.
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';

const App: React.FC = () => (
  <SafeAreaProvider>
    <RootNavigator />
  </SafeAreaProvider>
);

export default App;
