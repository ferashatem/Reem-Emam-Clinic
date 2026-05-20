import { buildWhatsAppLink } from '../../utils/whatsapp'

interface Props {
  phone: string
  message: string
  label?: string
}

export default function WhatsAppButton({ phone, message, label = 'إرسال واتساب' }: Props) {
  return (
    <a
      href={buildWhatsAppLink(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors"
      style={{ backgroundColor: '#25D366' }}
    >
      <span>💬</span>
      {label}
    </a>
  )
}
