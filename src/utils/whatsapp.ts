const GOOGLE_REVIEW_LINK = 'https://g.page/r/reem-glow-house/review'

export function buildConfirmationMessage(params: {
  clientName: string
  date: string
  time: string
  serviceName: string
  price: number
}) {
  return `✨ أهلاً ${params.clientName}!

تم تأكيد حجزك في ريم غلو هاوس 🌸

📅 التاريخ: ${params.date}
⏰ الوقت: ${params.time}
💆 الخدمة: ${params.serviceName}
💰 السعر: ${params.price} جنيه

في حالة أي استفسار تواصلي معنا 💕
— فريق ريم غلو هاوس`
}

export function buildReviewMessage(_clientName?: string) {
  return `✨ شكراً لزيارتك ريم غلو هاوس!

نتمنى تكوني استمتعتي بجلستك 🌸

رأيك يهمنا جداً —
قيّمي تجربتك هنا 👇
${GOOGLE_REVIEW_LINK}

شكراً لثقتك فينا 💕
— فريق ريم غلو هاوس`
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, '')
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`
}
