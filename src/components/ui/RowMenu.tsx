import { useState, type ReactNode } from 'react'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import MoreVertRounded from '@mui/icons-material/MoreVertRounded'

export interface RowAction {
  label: string
  icon?: ReactNode
  onClick: () => void
  /** Renders the item in red and puts it below a divider. */
  danger?: boolean
  disabled?: boolean
  /** Leaves the item out entirely — clearer than showing a dead option. */
  hidden?: boolean
  /** Opens a link instead of running a handler (WhatsApp, a file, a report). */
  href?: string
}

/**
 * The rest of a row's actions, behind one button.
 *
 * A row that carries six buttons makes the reader hunt for the one that
 * matters. The page keeps its single primary action visible and hands
 * everything else to this menu, so every row reads the same width and the
 * important thing stays obvious.
 */
export default function RowMenu({ actions, disabled }: { actions: RowAction[]; disabled?: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const items = actions.filter(a => !a.hidden)
  if (items.length === 0) return null

  const close = () => setAnchor(null)

  return (
    <>
      <IconButton
        size="small"
        disabled={disabled}
        aria-label="إجراءات"
        onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget) }}
      >
        <MoreVertRounded fontSize="small" />
      </IconButton>

      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={close}
        onClick={e => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { minWidth: 190, borderRadius: 2.5 } } }}
      >
        {items.map((a, i) => {
          const previous = items[i - 1]
          return [
            a.danger && previous && !previous.danger
              ? <Divider key={`${a.label}-div`} sx={{ my: 0.5 }} />
              : null,
            <MenuItem
              key={a.label}
              disabled={a.disabled}
              component={a.href ? 'a' : 'li'}
              {...(a.href ? { href: a.href, target: '_blank', rel: 'noopener noreferrer' } : null)}
              onClick={() => { close(); a.onClick?.() }}
              sx={a.danger ? { color: 'error.main' } : undefined}
            >
              {a.icon && (
                <ListItemIcon sx={a.danger ? { color: 'error.main' } : undefined}>
                  {a.icon}
                </ListItemIcon>
              )}
              <ListItemText slotProps={{ primary: { sx: { fontSize: '0.875rem', fontWeight: 600 } } }}>
                {a.label}
              </ListItemText>
            </MenuItem>,
          ]
        })}
      </Menu>
    </>
  )
}
