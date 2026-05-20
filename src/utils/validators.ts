export const phoneRegex = /^(\+20|0)?1[0-2,5]\d{8}$/

export function validateEgyptianPhone(phone: string): boolean {
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('20')) return `+${digits}`
  if (digits.startsWith('0')) return `+20${digits.slice(1)}`
  return `+20${digits}`
}
