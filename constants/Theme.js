export const LightColors = {
  bg:          '#F2F2F7',
  surface:     '#FFFFFF',
  card:        '#FFFFFF',
  border:      'rgba(60,60,67,0.12)',
  borderLight: 'rgba(60,60,67,0.06)',

  primary:   '#9B6DD6',
  secondary: '#D4709A',
  accent:    '#7C62C9',

  textPrimary:   '#1C1C1E',
  textSecondary: '#3C3C43CC',
  textMuted:     '#8E8E93',

  gradientPrimary: ['#B48DE0', '#DA8FBD'],
  gradientSubtle:  ['rgba(155,109,214,0.09)', 'rgba(212,112,154,0.05)'],
};

export const DarkColors = {
  bg:          '#161618',
  surface:     '#222224',
  card:        '#2C2C2E',
  border:      'rgba(255,255,255,0.12)',
  borderLight: 'rgba(255,255,255,0.06)',

  primary:   '#C9A4F0',
  secondary: '#E8A0C0',
  accent:    '#B09AEE',

  textPrimary:   '#ECECEC',
  textSecondary: 'rgba(236,236,236,0.70)',
  textMuted:     '#9A9A9E',

  gradientPrimary: ['#C9A4F0', '#E8A0C0'],
  gradientSubtle:  ['rgba(201,164,240,0.12)', 'rgba(232,160,192,0.06)'],
};

// Backwards compat — default to light
export const Colors = LightColors;

export const Radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   22,
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
