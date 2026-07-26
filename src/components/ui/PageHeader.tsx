import type { ReactNode } from 'react'
import { C } from '../../theme'

interface Props {
  title: string
  subtitle?: string
  action?: ReactNode
  back?: ReactNode
}

export default function PageHeader({ title, subtitle, action, back }: Props) {
  return (
    <div className="mb-6 sm:mb-8">
      {back}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: C.primary }}>{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}
