// VIBE OS design tokens. Dark "stage" theme: deep night background,
// gold spotlight accent, violet secondary.
export const colors = {
  bg: '#0B0A10',
  surface: '#15131D',
  surfaceAlt: '#1E1B29',
  border: '#2B2738',
  text: '#F5F3FA',
  textMuted: '#A19CB0',
  textFaint: '#6E6980',
  gold: '#F5B841',
  goldSoft: 'rgba(245,184,65,0.14)',
  violet: '#8B5CF6',
  violetSoft: 'rgba(139,92,246,0.16)',
  success: '#34D399',
  successSoft: 'rgba(52,211,153,0.14)',
  danger: '#F87171',
  dangerSoft: 'rgba(248,113,113,0.14)',
  warning: '#FBBF24',
  onGold: '#1A1405',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

// Large, readable sizes: the app targets users of every digital-literacy level.
export const font = {
  caption: 13,
  body: 16,
  bodyLg: 18,
  title: 22,
  h1: 28,
  display: 34,
} as const;

// Minimum tap target (Apple HIG 44pt, Material 48dp) -> use 52 for comfort.
export const TAP = 52;
