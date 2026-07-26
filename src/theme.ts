/** Single source of truth for the clinic palette — used by inline styles across the app. */
export const C = {
  primary: '#8B3A52',
  primarySoft: '#F2C4CE',
  bg: '#FDF6F0',
  text: '#2C1A1D',
  gold: '#C9956C',
  green: '#059669',
  amber: '#F59E0B',
  red: '#DC2626',
  blue: '#2563EB',
} as const

export const border = { borderColor: C.primarySoft }
