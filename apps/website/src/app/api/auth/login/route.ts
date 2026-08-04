import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { signSession, SESSION_COOKIE } from '@/lib/session'

// Zamanlama yan kanalı koruması: kullanıcı yoksa da bcrypt.compare çağrılacak
const DUMMY_HASH = '$2b$10$RhHop1MRdgOrzn.wsoB68OdJb0cQIupfd4j1r8VVYtPHH1EPA1Mm.'

export async function POST(req: Request) {
  const { username, password } = await req.json()
  if (!username || !password) {
    return NextResponse.json({ error: 'Kullanıcı adı ve şifre gerekli' }, { status: 400 })
  }

  const user = await prisma.adminUser.findUnique({ where: { username } })
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !valid) {
    return NextResponse.json({ error: 'Geçersiz kullanıcı adı veya şifre' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, signSession(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
