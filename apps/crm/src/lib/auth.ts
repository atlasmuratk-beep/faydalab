import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE, type SessionData } from './session'

export async function requireSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  return verifySession(token)
}
