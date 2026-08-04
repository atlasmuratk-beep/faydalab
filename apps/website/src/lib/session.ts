import { createHmac, timingSafeEqual } from 'crypto'

export const SESSION_COOKIE = 'faydalab_admin_session'

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET
  if (!value) throw new Error('ADMIN_SESSION_SECRET tanımlı değil')
  return value
}

export function signSession(userId: string): string {
  const payload = `${userId}.${Date.now()}`
  const sig = createHmac('sha256', secret()).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export function verifySession(token: string | undefined | null): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userId, issuedAtStr, sig] = parts
  const payload = `${userId}.${issuedAtStr}`
  const expected = createHmac('sha256', secret()).update(payload).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!timingSafeEqual(a, b)) return null
  const issuedAt = Number(issuedAtStr)
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > MAX_AGE_MS) return null
  return userId
}
