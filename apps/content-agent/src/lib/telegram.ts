function apiBase(): string {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`
}

export type TelegramSendResult = {
  chatId: string
  messageId: string
}

export async function sendContentPreview(
  contentItemId: string,
  imageUrl: string,
  caption: string
): Promise<TelegramSendResult> {
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID ortam değişkeni tanımlı değil')
  }

  const response = await fetch(`${apiBase()}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: imageUrl,
      caption,
      reply_markup: {
        // "Düzenle iste" butonu Faz 1b'ye ertelendi (bkz. plan: Known Deviations).
        inline_keyboard: [
          [
            { text: '✅ Onayla', callback_data: `approve:${contentItemId}` },
            { text: '❌ Reddet', callback_data: `reject:${contentItemId}` },
          ],
        ],
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Telegram sendPhoto başarısız: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  return { chatId: String(data.result.chat.id), messageId: String(data.result.message_id) }
}

export async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  await fetch(`${apiBase()}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  })
}

// Diğer fonksiyonların catch bloklarından çağrıldığı için asla hata fırlatmaz;
// Telegram tarafındaki bir arıza çağıranın akışını kesmemelidir.
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
