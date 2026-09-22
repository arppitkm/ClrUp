module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Colours and spacing come from the runtime theme (light/dark), so style
    // objects that depend on it cannot live in a static StyleSheet. Static
    // layout still does — see the StyleSheet.create block in every component.
    'react-native/no-inline-styles': 'off',
  },
};
