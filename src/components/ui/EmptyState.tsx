interface Props {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ icon = '🌸', title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: '#8B3A52' }}>{title}</h3>
      {description && <p className="text-sm text-gray-400 max-w-xs mb-6">{description}</p>}
      {action}
    </div>
  )
}
