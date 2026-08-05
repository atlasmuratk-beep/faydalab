function apiBase(): string {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`
}

// Çağıranın akışını asla kesmemesi için hata fırlatmaz.
export async function sendAlert(message: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) return

  try {
    await fetch(`${apiBase()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    })
  } catch (error) {
    console.error('Telegram uyarısı gönderilemedi:', error)
  }
}
