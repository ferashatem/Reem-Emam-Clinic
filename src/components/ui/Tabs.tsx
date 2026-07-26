import { C } from '../../theme'

export interface TabItem<T extends string> {
  value: T
  label: string
  count?: number
}

interface Props<T extends string> {
  tabs: TabItem<T>[]
  value: T
  onChange: (value: T) => void
}

/** Horizontally scrollable pill tabs — never wraps or overflows on a phone. */
export default function Tabs<T extends string>({ tabs, value, onChange }: Props<T>) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
      {tabs.map(tab => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors"
            style={
              active
                ? { backgroundColor: C.primary, color: '#fff', borderColor: C.primary }
                : { backgroundColor: '#fff', color: C.text, borderColor: C.primarySoft }
            }
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={
                  active
                    ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#fff' }
                    : { backgroundColor: C.bg, color: C.primary }
                }
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
