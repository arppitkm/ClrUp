module.exports = {
  preset: '@react-native/jest-preset',
  // These ship untranspiled ESM and must go through Babel.
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|@react-navigation|react-native-svg|react-native-screens|react-native-safe-area-context)/)',
  ],
};
