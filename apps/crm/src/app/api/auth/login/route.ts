import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { signSession, SESSION_COOKIE } from '@/lib/session'
import { isRateLimited } from '@/lib/rate-limit'

// Zamanlama yan kanalı koruması: kullanıcı yoksa da bcrypt.compare çağrılacak
const DUMMY_HASH = '$2b$10$RhHop1MRdgOrzn.wsoB68OdJb0cQIupfd4j1r8VVYtPHH1EPA1Mm.'

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ?? 'unknown'
  if (isRateLimited(ip, 10, 60_000)) {
    return NextResponse.json({ error: 'Çok fazla deneme, lütfen daha sonra tekrar deneyin' }, { status: 429 })
  }

  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'E-posta ve şifre gerekli' }, { status: 400 })
  }

  const user = await prisma.adminUser.findUnique({ where: { email } })
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !valid) {
    return NextResponse.json({ error: 'Geçersiz e-posta veya şifre' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, signSession(user.id, user.tenantId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
