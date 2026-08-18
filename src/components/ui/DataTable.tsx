import { useMemo, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import TablePagination from '@mui/material/TablePagination'
import Skeleton from '@mui/material/Skeleton'
import { C } from '../../theme'

/** One column of the table. `render` draws the cell; `sortValue` orders it. */
export interface Column<T> {
  id: string
  label: string
  render: (row: T) => ReactNode
  /** Return a string or number to make the column sortable. */
  sortValue?: (row: T) => string | number
  align?: 'right' | 'left' | 'center'
  width?: number | string
  /** Drop the column on narrow screens so the important ones stay readable. */
  hideBelow?: 'sm' | 'md' | 'lg'
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  getRowId: (row: T) => string
  loading?: boolean
  /** Shown in place of the rows when there are none. */
  empty?: ReactNode
  /** Column to sort by on first render. */
  defaultSort?: { id: string; dir: 'asc' | 'desc' }
  onRowClick?: (row: T) => void
  /** Off for short, self-contained lists that never grow. */
  paginated?: boolean
  rowsPerPageOptions?: number[]
  /** Tints a whole row — a booking that still owes money, say. */
  rowSx?: (row: T) => object | undefined
  /** Caps the body height so the header stays put while the rows scroll. */
  maxHeight?: number | string
  /**
   * Stretches the table to whatever height its parent gives it, so the rows —
   * and nothing else — do the scrolling. The page around it then never grows a
   * scrollbar of its own.
   */
  fill?: boolean
  /**
   * Filters and tabs, drawn inside the table's own frame. Keeping them here
   * rather than loose above the table is what stops a page turning into three
   * stacked bars of chrome before the reader reaches a single row.
   */
  header?: ReactNode
}

const hideAt = {
  sm: { display: { xs: 'none', sm: 'table-cell' } },
  md: { display: { xs: 'none', md: 'table-cell' } },
  lg: { display: { xs: 'none', lg: 'table-cell' } },
} as const

/**
 * The one table every list in the dashboard is built from.
 *
 * Sorting, pagination, a header that stays put, and a single place to fix
 * whatever turns out to be wrong with all of them. Columns can drop out on a
 * phone rather than forcing a sideways scroll through eight of them.
 */
export default function DataTable<T>({
  columns,
  rows,
  getRowId,
  loading = false,
  empty,
  defaultSort,
  onRowClick,
  paginated = true,
  rowsPerPageOptions = [10, 25, 50],
  rowSx,
  maxHeight = '65vh',
  header,
  fill = false,
}: Props<T>) {
  const [sort, setSort] = useState(defaultSort ?? null)
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(rowsPerPageOptions[0])

  const sorted = useMemo(() => {
    const col = sort && columns.find(c => c.id === sort.id)
    if (!col?.sortValue) return rows
    const dir = sort?.dir === 'desc' ? -1 : 1
    // A copy: the caller's array is its own business.
    return [...rows].sort((a, b) => {
      const x = col.sortValue!(a)
      const y = col.sortValue!(b)
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir
      return String(x).localeCompare(String(y), 'ar') * dir
    })
  }, [rows, sort, columns])

  // A filter can empty the page you were on, so the view falls back to the last
  // page that still has rows rather than showing a blank table.
  const pageCount = Math.max(1, Math.ceil(sorted.length / perPage))
  const safePage = Math.min(page, pageCount - 1)
  const visible = paginated
    ? sorted.slice(safePage * perPage, safePage * perPage + perPage)
    : sorted

  function toggleSort(id: string) {
    setSort(s => (s?.id === id
      ? { id, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { id, dir: 'asc' }))
    setPage(0)
  }

  return (
    <Paper
      variant="outlined"
      dir="rtl"
      sx={{
        overflow: 'hidden',
        borderColor: C.primarySoft,
        bgcolor: '#fff',
        ...(fill ? { height: '100%', display: 'flex', flexDirection: 'column' } : null),
      }}
    >
      {header}

      <TableContainer sx={fill ? { flex: 1, minHeight: 0 } : { maxHeight }}>
        <Table stickyHeader size="small" sx={{ minWidth: 560 }}>
          <TableHead>
            <TableRow>
              {columns.map(col => (
                <TableCell
                  key={col.id}
                  align={col.align ?? 'right'}
                  sx={{ width: col.width, ...(col.hideBelow ? hideAt[col.hideBelow] : null) }}
                  sortDirection={sort?.id === col.id ? sort.dir : false}
                >
                  {col.sortValue ? (
                    <TableSortLabel
                      active={sort?.id === col.id}
                      direction={sort?.id === col.id ? sort.dir : 'asc'}
                      onClick={() => toggleSort(col.id)}
                    >
                      {col.label}
                    </TableSortLabel>
                  ) : col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              // Rows in outline, so the page doesn't jump when the data lands
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map(col => (
                    <TableCell
                      key={col.id}
                      sx={col.hideBelow ? hideAt[col.hideBelow] : undefined}
                    >
                      <Skeleton variant="text" height={22} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ border: 0, p: 0 }}>
                  {empty ?? (
                    <Box sx={{ py: 7, textAlign: 'center', color: 'text.secondary' }}>
                      مفيش نتايج
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              visible.map(row => (
                <TableRow
                  key={getRowId(row)}
                  hover
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    ...rowSx?.(row),
                  }}
                >
                  {columns.map(col => (
                    <TableCell
                      key={col.id}
                      align={col.align ?? 'right'}
                      sx={{ py: 1.25, ...(col.hideBelow ? hideAt[col.hideBelow] : null) }}
                    >
                      {col.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {paginated && !loading && sorted.length > rowsPerPageOptions[0] && (
        <TablePagination
          component="div"
          count={sorted.length}
          page={safePage}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={perPage}
          onRowsPerPageChange={e => { setPerPage(Number(e.target.value)); setPage(0) }}
          rowsPerPageOptions={rowsPerPageOptions}
          labelRowsPerPage="عدد الصفوف"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} من ${count}`}
          sx={{ borderTop: `1px solid ${C.primarySoft}` }}
        />
      )}
    </Paper>
  )
}
