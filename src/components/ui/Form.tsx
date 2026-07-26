import type {
  ReactNode, InputHTMLAttributes, SelectHTMLAttributes,
  TextareaHTMLAttributes, ButtonHTMLAttributes, Ref, CSSProperties,
} from 'react'
import { C } from '../../theme'

const base =
  'w-full rounded-xl px-4 py-3 text-sm bg-white border transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-[#8B3A52]/20 focus:border-[#8B3A52] ' +
  'disabled:bg-gray-50 disabled:text-gray-400'

function borderColor(invalid?: boolean) {
  return invalid ? '#ef4444' : C.primarySoft
}

interface FieldProps {
  label: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}

export function Field({ label, error, hint, required, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium mb-1.5" style={{ color: C.text }}>
        {label}
        {required && <span className="text-red-500 mr-1">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-500 mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-400 mt-1.5">{hint}</p>
      ) : null}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; ref?: Ref<HTMLInputElement> }

export function Input({ invalid, className = '', style, ...props }: InputProps) {
  return (
    <input
      {...props}
      className={`${base} ${className}`}
      style={{ borderColor: borderColor(invalid), ...style }}
    />
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; ref?: Ref<HTMLSelectElement> }

export function Select({ invalid, className = '', style, children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={`${base} appearance-none ${className}`}
      style={{ borderColor: borderColor(invalid), ...style }}
    >
      {children}
    </select>
  )
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; ref?: Ref<HTMLTextAreaElement> }

export function Textarea({ invalid, className = '', style, ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      className={`${base} resize-none ${className}`}
      style={{ borderColor: borderColor(invalid), ...style }}
    />
  )
}

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'success'

const variants: Record<ButtonVariant, string> = {
  primary: 'text-white border-transparent',
  outline: 'bg-white',
  ghost: 'bg-transparent border-transparent',
  danger: 'text-white border-transparent',
  success: 'text-white border-transparent',
}

const variantStyle: Record<ButtonVariant, CSSProperties> = {
  primary: { backgroundColor: C.primary },
  outline: { borderColor: C.primarySoft, color: C.primary },
  ghost: { color: C.primary },
  danger: { backgroundColor: C.red },
  success: { backgroundColor: C.green },
}

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary', size = 'md', loading, disabled, children, className = '', style, ...props
}: ButtonProps) {
  const sizeCls = size === 'sm' ? 'px-3 py-2 text-xs' : 'px-5 py-2.5 text-sm'
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`rounded-xl font-medium border transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${sizeCls} ${variants[variant]} ${className}`}
      style={{ ...variantStyle[variant], ...style }}
    >
      {loading ? 'جارٍ الحفظ...' : children}
    </button>
  )
}
