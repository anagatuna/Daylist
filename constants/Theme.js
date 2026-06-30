export const LightColors = {
  bg:          '#F2F2F7',
  surface:     '#FFFFFF',
  card:        '#FFFFFF',
  border:      'rgba(60,60,67,0.12)',
  borderLight: 'rgba(60,60,67,0.06)',

  primary:   '#9B6DD6',
  secondary: '#D4709A',
  accent:    '#7C62C9',

  success: '#34C759',
  danger:  '#FF3B30',
  streak:  '#FF9500',
  streakAlt: '#FF5722',
  spotify: '#1DB954',

  textPrimary:   '#1C1C1E',
  textSecondary: '#3C3C43CC',
  textMuted:     '#8E8E93',

  gradientPrimary: ['#B48DE0', '#DA8FBD'],
  gradientSubtle:  ['rgba(155,109,214,0.09)', 'rgba(212,112,154,0.05)'],
  gradientStreak:  ['#FF9500', '#FF5722'],

  glass: {
    tint: 'light',
    overlay: 'rgba(255,255,255,0.55)',
    overlayStrong: 'rgba(255,255,255,0.78)',
    border: 'rgba(255,255,255,0.5)',
    intensity: 70,
  },

  navBar: {
    tint: 'light',
    intensity: 75,
    overlay: 'rgba(210,185,235,0.46)',
    border: 'rgba(124,79,194,0.32)',
    highlight: 'rgba(255,255,255,0.9)',
    activeDot: '#9B6DD6',
    inactiveTint: '#9B6DD6',
    shadowOpacity: 0.22,
  },

  cardGlass: {
    tint: 'light',
    intensity: 55,
    overlay: 'rgba(255,255,255,0.38)',
    border: 'rgba(255,255,255,0.55)',
    shadowOpacity: 0.18,
    shadowOpacitySm: 0.14,
  },
};

export const DarkColors = {
  bg:          '#1A1620',
  surface:     '#27212F',
  card:        '#322B3C',
  border:      'rgba(201,164,240,0.14)',
  borderLight: 'rgba(201,164,240,0.07)',

  primary:   '#C9A4F0',
  secondary: '#E8A0C0',
  accent:    '#B09AEE',

  success: '#30D158',
  danger:  '#FF453A',
  streak:  '#FF9F0A',
  streakAlt: '#FF6B35',
  spotify: '#1ED760',

  textPrimary:   '#ECECEC',
  textSecondary: 'rgba(236,236,236,0.70)',
  textMuted:     '#9A9A9E',

  gradientPrimary: ['#C9A4F0', '#E8A0C0'],
  gradientSubtle:  ['rgba(201,164,240,0.12)', 'rgba(232,160,192,0.06)'],
  gradientStreak:  ['#FF9F0A', '#FF6B35'],

  glass: {
    tint: 'dark',
    overlay: 'rgba(28,28,30,0.55)',
    overlayStrong: 'rgba(28,28,30,0.78)',
    border: 'rgba(255,255,255,0.12)',
    intensity: 65,
  },

  navBar: {
    tint: 'dark',
    intensity: 25,
    overlay: 'rgba(58,36,86,0.72)',
    border: 'rgba(201,164,240,0.3)',
    activeDot: '#D9BBF5',
    inactiveTint: '#C9A4F0',
  },

  cardGlass: {
    tint: 'dark',
    intensity: 28,
    overlay: 'rgba(44,30,60,0.48)',
    border: 'transparent',
    shadowOpacity: 0.10,
    shadowOpacitySm: 0.08,
  },
};

// Backwards compat — default to light
export const Colors = LightColors;

export const Radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   22,
  xxl:  28,
  pill: 100,
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 6,
  },
};
