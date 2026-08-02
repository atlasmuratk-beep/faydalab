import { timingSafeEqual } from 'crypto'

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

export function verifyInternalAuthHeader(authHeader: string | null): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret || !authHeader) return false
  return timingSafeStringEqual(authHeader, `Bearer ${secret}`)
}

export function verifyTelegramWebhookSecret(providedSecret: string | null): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret || !providedSecret) return false
  return timingSafeStringEqual(providedSecret, secret)
}
