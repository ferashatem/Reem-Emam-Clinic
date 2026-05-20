interface Props {
  label: string
  value: string | number
  icon: string
  color?: string
}

export default function StatCard({ label, value, icon, color = '#8B3A52' }: Props) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border" style={{ borderColor: '#F2C4CE' }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-2xl">{icon}</span>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        </div>
      </div>
      <p className="text-3xl font-bold mb-1" style={{ color }}>{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  )
}
