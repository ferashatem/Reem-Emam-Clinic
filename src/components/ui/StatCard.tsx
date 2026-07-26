import { C } from '../../theme'

interface Props {
  label: string
  value: string | number
  icon: string
  color?: string
  hint?: string
}

export default function StatCard({ label, value, icon, color = C.primary, hint }: Props) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border" style={{ borderColor: C.primarySoft }}>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          {icon}
        </span>
        <p className="text-xs sm:text-sm text-gray-500 leading-tight">{label}</p>
      </div>
      <p className="text-xl sm:text-2xl font-bold wrap-break-word" style={{ color }}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}
