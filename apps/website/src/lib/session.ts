import { createHmac, timingSafeEqual } from 'crypto'

export const SESSION_COOKIE = 'faydalab_admin_session'

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET
  if (!value) throw new Error('ADMIN_SESSION_SECRET tanımlı değil')
  return value
}

export function signSession(userId: string): string {
  const sig = createHmac('sha256', secret()).update(userId).digest('hex')
  return `${userId}.${sig}`
}

export function verifySession(token: string | undefined | null): string | null {
  if (!token) return null
  const separatorIndex = token.lastIndexOf('.')
  if (separatorIndex === -1) return null
  const userId = token.slice(0, separatorIndex)
  const sig = token.slice(separatorIndex + 1)
  const expected = createHmac('sha256', secret()).update(userId).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  return timingSafeEqual(a, b) ? userId : null
}
