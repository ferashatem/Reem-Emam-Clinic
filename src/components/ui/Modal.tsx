import { useEffect, type ReactNode } from 'react'
import { C } from '../../theme'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
}

/** Centered dialog on desktop, bottom sheet on phones. Closes on Escape. */
export default function Modal({ open, onClose, title, children, width = 'max-w-lg' }: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white w-full ${width} rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col`}>
        <div
          className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b shrink-0 rounded-t-3xl sm:rounded-t-2xl bg-white"
          style={{ borderColor: C.primarySoft }}
        >
          <h3 className="text-base sm:text-lg font-semibold truncate" style={{ color: C.primary }}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500"
          >
            ✕
          </button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
