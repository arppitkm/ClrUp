/**
 * ClrUp design tokens — the single source of truth for the visual language.
 *
 * Rule that governs the palette: `mint` means "space you get back". Nothing
 * else in the app is mint, so the number the user actually cares about is
 * always the brightest thing on screen. `danger` appears exactly once, on the
 * final delete confirmation.
 */

/** Raw brand values. Prefer `theme.color.*` in components over these. */
export const palette = {
  mint: '#14C8A0',
  mintDeep: '#0B8F76',
  mintLite: '#5FE3C0',

  ink: '#0B0F14',
  inkRaised: '#141A21',
  inkBorder: '#1C2530',

  white: '#FFFFFF',
  cloud: '#F4F6F8',
  cloudBorder: '#E3E8EE',

  slate: '#5C6B7A',
  frost: '#EAF2F7',

  danger: '#FF5A5F',
} as const;

/**
 * One accent per cleanable category, used consistently from the dashboard ring
 * segment through to the section header and selection checkmark. Keyed by
 * `CategoryId` so a new category cannot be added without picking its colour.
 */
export const categoryColor = {
  similarPhotos: '#5B8DEF',
  screenshots: '#A16BFF',
  largeVideos: '#FFB020',
  duplicateContacts: '#FF7A9A',
} as const;

export type CategoryId = keyof typeof categoryColor;

/** 4pt base scale. Spacing is never hand-tuned in components. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/**
 * Type scale. `tabular: true` forces monospaced digits so streaming counts
 * don't jitter while a scan is running — every size figure in the app uses it.
 */
export const typography = {
  display: { fontSize: 34, fontWeight: '800', letterSpacing: -0.85, tabular: true },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.33, tabular: false },
  headline: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, tabular: false },
  body: { fontSize: 15, fontWeight: '400', letterSpacing: 0, tabular: false },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0, tabular: false },
  caption: { fontSize: 11, fontWeight: '600', letterSpacing: 0.66, tabular: false },
} as const;

export type TypographyVariant = keyof typeof typography;

export const duration = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;
