import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyInternalAuthHeader } from '@/lib/auth'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!verifyInternalAuthHeader(authHeader)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { accessToken, expiresInSeconds } = body

  if (typeof accessToken !== 'string' || typeof expiresInSeconds !== 'number') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  await prisma.integrationToken.upsert({
    where: { provider: 'instagram' },
    create: {
      provider: 'instagram',
      accessToken,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    },
    update: {
      accessToken,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    },
  })

  return NextResponse.json({ ok: true })
}
