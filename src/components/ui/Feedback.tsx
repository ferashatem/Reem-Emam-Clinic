import { C } from '../../theme'

export function Spinner({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="جارٍ التحميل"
      className={`animate-spin rounded-full border-4 border-t-transparent ${className}`}
      style={{ borderColor: C.primary, borderTopColor: 'transparent' }}
    />
  )
}

export function LoadingBlock({ label = 'جارٍ التحميل...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <Spinner />
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="text-4xl mb-3">⚠️</div>
      <h3 className="text-base font-semibold mb-2" style={{ color: C.primary }}>حصلت مشكلة</h3>
      <p className="text-sm text-gray-500 max-w-sm mb-5">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-5 py-2.5 rounded-xl text-white text-sm font-medium"
          style={{ backgroundColor: C.primary }}
        >
          حاولي تاني
        </button>
      )}
    </div>
  )
}
