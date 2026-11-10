// VIBE OS design tokens. Dark "stage" theme: deep night background,
// gold spotlight accent, violet secondary.
export type ThemeId = 'stage' | 'rose' | 'amethyst' | 'ocean' | 'graphite' | 'daylight';
export const THEME_IDS: ThemeId[] = ['stage', 'rose', 'amethyst', 'ocean', 'graphite', 'daylight'];

/** "gold" is the primary accent and "violet" the secondary accent of every theme. */
export interface Palette {
  mode: 'dark' | 'light';
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  gold: string;
  goldSoft: string;
  violet: string;
  violetSoft: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  onGold: string;
}

export const THEMES: Record<ThemeId, Palette> = {
  // Dark stage with a gold spotlight (default).
  stage: {
    mode: 'dark',
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
  },
  // Light cream with rose and champagne accents.
  rose: {
    mode: 'light',
    bg: '#FBF6F4',
    surface: '#FFFFFF',
    surfaceAlt: '#F5EBE8',
    border: '#EAD8D3',
    text: '#2A1C21',
    textMuted: '#76606A',
    textFaint: '#A8939B',
    gold: '#C4677A',
    goldSoft: 'rgba(196,103,122,0.13)',
    violet: '#A8834B',
    violetSoft: 'rgba(168,131,75,0.14)',
    success: '#23885F',
    successSoft: 'rgba(35,136,95,0.12)',
    danger: '#C9423F',
    dangerSoft: 'rgba(201,66,63,0.11)',
    warning: '#B7791F',
    onGold: '#FFFFFF',
  },
  // Deep purple with orchid accents.
  amethyst: {
    mode: 'dark',
    bg: '#120D1D',
    surface: '#1C152D',
    surfaceAlt: '#261D3B',
    border: '#392D54',
    text: '#F7F2FF',
    textMuted: '#B6A9D2',
    textFaint: '#7E719C',
    gold: '#EC8BCB',
    goldSoft: 'rgba(236,139,203,0.15)',
    violet: '#A78BFA',
    violetSoft: 'rgba(167,139,250,0.17)',
    success: '#4ADE9B',
    successSoft: 'rgba(74,222,155,0.14)',
    danger: '#FB7185',
    dangerSoft: 'rgba(251,113,133,0.15)',
    warning: '#FBBF24',
    onGold: '#2A0A1F',
  },
  // Night navy with electric blue.
  ocean: {
    mode: 'dark',
    bg: '#07131F',
    surface: '#0E1D2D',
    surfaceAlt: '#15283C',
    border: '#22384F',
    text: '#EEF5FB',
    textMuted: '#9DB3C7',
    textFaint: '#62798E',
    gold: '#3DB5FF',
    goldSoft: 'rgba(61,181,255,0.15)',
    violet: '#2DD4BF',
    violetSoft: 'rgba(45,212,191,0.15)',
    success: '#34D399',
    successSoft: 'rgba(52,211,153,0.14)',
    danger: '#F87171',
    dangerSoft: 'rgba(248,113,113,0.14)',
    warning: '#FBBF24',
    onGold: '#04121E',
  },
  // Graphite with a bold orange.
  graphite: {
    mode: 'dark',
    bg: '#101113',
    surface: '#191B1E',
    surfaceAlt: '#23262A',
    border: '#33373D',
    text: '#F2F4F5',
    textMuted: '#A4AAB0',
    textFaint: '#6C737A',
    gold: '#FF7A3D',
    goldSoft: 'rgba(255,122,61,0.15)',
    violet: '#60A5FA',
    violetSoft: 'rgba(96,165,250,0.16)',
    success: '#34D399',
    successSoft: 'rgba(52,211,153,0.14)',
    danger: '#F87171',
    dangerSoft: 'rgba(248,113,113,0.14)',
    warning: '#FBBF24',
    onGold: '#1F0B02',
  },
  // Clean light theme for daylight readability.
  daylight: {
    mode: 'light',
    bg: '#F5F7FA',
    surface: '#FFFFFF',
    surfaceAlt: '#EDF0F4',
    border: '#DCE1E7',
    text: '#12161C',
    textMuted: '#5B636D',
    textFaint: '#97A0AA',
    gold: '#2563EB',
    goldSoft: 'rgba(37,99,235,0.11)',
    violet: '#7C3AED',
    violetSoft: 'rgba(124,58,237,0.11)',
    success: '#15803D',
    successSoft: 'rgba(21,128,61,0.11)',
    danger: '#DC2626',
    dangerSoft: 'rgba(220,38,38,0.10)',
    warning: '#B45309',
    onGold: '#FFFFFF',
  },
};

/** Live palette. Mutated in place by applyTheme(); read it during render, never cache it at module level. */
export const colors: Palette = { ...THEMES.stage };

let currentTheme: ThemeId = 'stage';
let themeVersion = 0;

export function applyTheme(id: ThemeId | undefined | null): void {
  const next: ThemeId = id && THEMES[id] ? id : 'stage';
  if (next === currentTheme) return;
  Object.assign(colors, THEMES[next]);
  currentTheme = next;
  themeVersion++;
}

export const getThemeId = () => currentTheme;

/**
 * Module-level values that depend on colors (style sheets, color maps) are wrapped in themed():
 * they are rebuilt lazily the first time they are read after a theme change.
 */
export function themed<T extends object>(build: () => T): T {
  let cache: T | null = null;
  let builtFor = -1;
  const current = (): T => {
    if (!cache || builtFor !== themeVersion) {
      cache = build();
      builtFor = themeVersion;
    }
    return cache;
  };
  return new Proxy({} as T, {
    get: (_t, key) => (current() as Record<string | symbol, unknown>)[key],
    has: (_t, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_t, key) => {
      const d = Reflect.getOwnPropertyDescriptor(current(), key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

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
