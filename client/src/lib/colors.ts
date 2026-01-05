/**
 * Midnight Indigo Color System
 * Uses CSS variables from index.css for dynamic theming
 */

export const tokens = {
  // Surfaces
  bg: 'var(--bg-hex)',
  surface: 'var(--surface-hex)',
  surfaceAlt: 'var(--surface-alt-hex)',
  border: 'var(--border-hex)',

  // Text
  textPrimary: 'var(--text-primary-hex)',
  textSecondary: 'var(--text-secondary-hex)',
  textMuted: 'var(--text-muted-hex)',

  // Brand
  primary: 'var(--primary-hex)',
  primaryHover: 'var(--primary-hover-hex)',
  primarySoft: 'var(--primary-soft-hex)',

  secondary: 'var(--secondary-hex)',
  secondarySoft: 'var(--secondary-soft-hex)',

  // States
  success: 'var(--success-hex)',
  successSoft: 'var(--success-soft-hex)',

  warning: 'var(--warning-hex)',
  warningSoft: 'var(--warning-soft-hex)',

  danger: 'var(--danger-hex)',
  dangerSoft: 'var(--danger-soft-hex)',

  info: 'var(--info-hex)',
  infoSoft: 'var(--info-soft-hex)',
  
  // Overlay & Misc
  overlay: 'var(--overlay-hex)',
  onPrimary: 'var(--on-primary-hex)',
};

/**
 * Get score chip colors based on score value
 * Score 5: success (green = verified)
 * Score 4: info (blue = structure)
 * Score 3: warning (amber = tension)
 * Score 2: warning (amber = tension)
 * Score 1: danger (red = invalid)
 */
export const getScoreChipColors = (score: number) => {
  if (score === 5) return { bg: tokens.successSoft, text: tokens.success };
  if (score === 4) return { bg: tokens.infoSoft, text: tokens.info };
  if (score === 3) return { bg: tokens.warningSoft, text: tokens.warning };
  if (score === 2) return { bg: tokens.warningSoft, text: tokens.warning };
  return { bg: tokens.dangerSoft, text: tokens.danger };
};

/**
 * Classification badge colors
 * brainlift = green (verified/correct)
 * partial = amber (tension/warning)
 * not_brainlift = amber (not the right format, but not broken)
 */
export const classificationColors = {
  brainlift: { bg: tokens.successSoft, text: tokens.success },
  partial: { bg: tokens.warningSoft, text: tokens.warning },
  not_brainlift: { bg: tokens.warningSoft, text: tokens.warning },
};
