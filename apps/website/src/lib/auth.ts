import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from './session'

export async function requireSession(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  return verifySession(token)
}
