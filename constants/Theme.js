export const Colors = {
  // Backgrounds — iOS system layered whites
  bg:          '#F2F2F7',   // iOS systemGroupedBackground
  surface:     '#FFFFFF',
  card:        '#FFFFFF',
  border:      'rgba(60,60,67,0.12)',
  borderLight: 'rgba(60,60,67,0.06)',

  // Brand — muted lavender-rose, feminine without being loud
  primary:   '#9B6DD6',   // soft purple
  secondary: '#D4709A',   // dusty rose
  accent:    '#7C62C9',   // deeper lavender

  // Text — iOS label system
  textPrimary:   '#1C1C1E',
  textSecondary: '#3C3C43CC',  // secondaryLabel ~80% opacity
  textMuted:     '#8E8E93',

  // Gradients
  gradientPrimary: ['#B48DE0', '#DA8FBD'],
  gradientSubtle:  ['rgba(155,109,214,0.09)', 'rgba(212,112,154,0.05)'],
};

export const Radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   22,
  pill: 100,
};

// iOS-style shadow — use with style spread
export const Shadow = {
  sm: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 8,
  },
};
