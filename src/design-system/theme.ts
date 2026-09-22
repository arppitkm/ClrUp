import { useColorScheme } from 'react-native';
import { palette, categoryColor, spacing, radius, typography, duration } from './tokens';

/**
 * Semantic colour roles. Components reference these, never raw hex, so the
 * light/dark pair is defined in exactly one place.
 */
export type ThemeColors = {
  /** Screen background. */
  background: string;
  /** Raised surfaces: cards, list rows. */
  surface: string;
  /** Hairlines and dividers. */
  border: string;
  /** The unfilled remainder of a progress ring. */
  track: string;

  text: string;
  textDim: string;
  /** Text sitting on top of `accent`. */
  textOnAccent: string;

  /** Reserved for reclaimable space. See tokens.ts. */
  accent: string;
  accentPressed: string;

  danger: string;
};

const light: ThemeColors = {
  background: palette.cloud,
  surface: palette.white,
  border: palette.cloudBorder,
  track: palette.cloudBorder,

  text: palette.ink,
  textDim: palette.slate,
  textOnAccent: '#04241E',

  accent: palette.mint,
  accentPressed: palette.mintDeep,

  danger: palette.danger,
};

const dark: ThemeColors = {
  background: palette.ink,
  surface: palette.inkRaised,
  border: palette.inkBorder,
  track: palette.inkBorder,

  text: palette.frost,
  textDim: palette.slate,
  textOnAccent: '#04241E',

  // Mint Lite reads brighter against ink without blooming.
  accent: palette.mintLite,
  accentPressed: palette.mint,

  danger: palette.danger,
};

export type Theme = {
  scheme: 'light' | 'dark';
  color: ThemeColors;
  category: typeof categoryColor;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  duration: typeof duration;
};

const build = (scheme: 'light' | 'dark'): Theme => ({
  scheme,
  color: scheme === 'dark' ? dark : light,
  category: categoryColor,
  spacing,
  radius,
  typography,
  duration,
});

const themes = { light: build('light'), dark: build('dark') } as const;

/**
 * Follows the system appearance. Themes are pre-built module constants, so this
 * returns a stable reference and never invalidates memoised styles on re-render.
 */
export const useTheme = (): Theme => (useColorScheme() === 'dark' ? themes.dark : themes.light);
