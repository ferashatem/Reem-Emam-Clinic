import { useMemo, type ReactNode } from 'react'
import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { prefixer } from 'stylis'
import rtlPlugin from 'stylis-plugin-rtl'
import { C } from '../theme'

/**
 * The dashboard is Arabic, so every MUI component is laid out right-to-left:
 * the theme says so, and this cache rewrites the generated CSS (padding-left →
 * padding-right, and so on) to match. Without it a menu would open off the
 * wrong edge and every icon would sit on the wrong side of its label.
 */
const rtlCache = createCache({
  key: 'mui-rtl',
  stylisPlugins: [prefixer, rtlPlugin],
})

/**
 * MUI dressed in the clinic's own colours — wine, blush and cream — so the
 * tables read as part of the app rather than as a component library dropped
 * into it.
 */
const clinicTheme = createTheme({
  direction: 'rtl',
  palette: {
    primary: { main: C.primary, contrastText: '#fff' },
    secondary: { main: C.gold },
    success: { main: C.green },
    warning: { main: C.amber },
    error: { main: C.red },
    info: { main: C.blue },
    background: { default: C.bg, paper: '#fff' },
    text: { primary: C.text, secondary: '#6B7280' },
    divider: C.primarySoft,
  },
  typography: {
    fontFamily: 'Tajawal, sans-serif',
    // Arabic reads small at the same pixel size, so the scale starts a notch up
    fontSize: 14,
    button: { textTransform: 'none', fontWeight: 700 },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: C.primarySoft },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: '#F3E7EA',
          // Numbers line up under each other in every column that holds them
          fontVariantNumeric: 'tabular-nums',
        },
        head: {
          backgroundColor: C.bg,
          color: C.primary,
          fontWeight: 700,
          fontSize: '0.8rem',
          whiteSpace: 'nowrap',
          lineHeight: 1.4,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-of-type td': { borderBottom: 0 },
          transition: 'background-color .15s',
        },
        hover: { '&:hover': { backgroundColor: 'rgba(139,58,82,0.035)' } },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 700 },
        sizeSmall: { height: 24 },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
  },
})

/** Wraps the app so every MUI component gets the clinic theme and RTL cache. */
export default function MuiProvider({ children }: { children: ReactNode }) {
  const theme = useMemo(() => clinicTheme, [])
  return (
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </CacheProvider>
  )
}
