import { useState, useCallback, type ReactNode } from 'react'
import Modal from './Modal'
import { Button } from './Form'

interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmLabel?: string
  danger?: boolean
}

/**
 * Replaces window.confirm (which is blocked in some in-app browsers and looks
 * broken on mobile) with a styled RTL dialog.
 *
 *   const { confirm, dialog } = useConfirm()
 *   if (await confirm({ title: '...' })) { ... }
 *   return <>{dialog}</>
 */
export function useConfirm() {
  const [state, setState] = useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>(resolve => setState({ ...options, resolve }))
  }, [])

  function close(result: boolean) {
    state?.resolve(result)
    setState(null)
  }

  const dialog = (
    <Modal open={!!state} onClose={() => close(false)} title={state?.title ?? ''} width="max-w-sm">
      {state && (
        <div className="space-y-5">
          {state.message && <div className="text-sm text-gray-600 leading-relaxed">{state.message}</div>}
          <div className="flex gap-3">
            <Button
              variant={state.danger ? 'danger' : 'primary'}
              className="flex-1"
              onClick={() => close(true)}
            >
              {state.confirmLabel ?? 'تأكيد'}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => close(false)}>
              رجوع
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )

  return { confirm, dialog }
}
