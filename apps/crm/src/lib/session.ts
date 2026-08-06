import { createHmac, timingSafeEqual } from 'crypto'

export const SESSION_COOKIE = 'faydalab_crm_session'

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export interface SessionData {
  userId: string
  tenantId: string
}

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET
  if (!value) throw new Error('ADMIN_SESSION_SECRET tanımlı değil')
  return value
}

export function signSession(userId: string, tenantId: string): string {
  const payload = `${userId}.${tenantId}.${Date.now()}`
  const sig = createHmac('sha256', secret()).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export function verifySession(token: string | undefined | null): SessionData | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [userId, tenantId, issuedAtStr, sig] = parts
  const payload = `${userId}.${tenantId}.${issuedAtStr}`
  const expected = createHmac('sha256', secret()).update(payload).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!timingSafeEqual(a, b)) return null
  const issuedAt = Number(issuedAtStr)
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > MAX_AGE_MS) return null
  return { userId, tenantId }
}
