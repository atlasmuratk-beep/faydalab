import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createTenant } from '@/lib/tenant'
import { signSession, SESSION_COOKIE } from '@/lib/session'
import { isRateLimited } from '@/lib/rate-limit'

const signupSchema = z.object({
  businessName: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
})

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ?? 'unknown'
  if (isRateLimited(`signup:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Çok fazla deneme, lütfen daha sonra tekrar deneyin' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = signupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    return NextResponse.json({ error: 'Bu e-posta ile zaten bir hesap var' }, { status: 409 })
  }

  const tenant = await createTenant(parsed.data.businessName)
  const passwordHash = await bcrypt.hash(parsed.data.password, 10)

  let user
  try {
    user = await prisma.adminUser.create({
      data: { email: parsed.data.email, passwordHash, tenantId: tenant.id },
    })
  } catch (error) {
    await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {})
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Bu e-posta ile zaten bir hesap var' }, { status: 409 })
    }
    throw error
  }

  const res = NextResponse.json({ ok: true }, { status: 201 })
  res.cookies.set(SESSION_COOKIE, signSession(user.id, tenant.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
