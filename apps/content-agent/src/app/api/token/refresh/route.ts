import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { refreshLongLivedToken } from '@/lib/instagram'
import { sendAlert } from '@/lib/telegram'
import { verifyInternalAuthHeader } from '@/lib/auth'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (!verifyInternalAuthHeader(authHeader)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const token = await prisma.integrationToken.findUnique({ where: { provider: 'instagram' } })
  if (!token) {
    await sendAlert('Token yenileme atlandı: kayıtlı Instagram token yok')
    return NextResponse.json({ error: 'no_token' }, { status: 404 })
  }

  try {
    const { accessToken, expiresInSeconds } = await refreshLongLivedToken(token.accessToken)
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000)

    await prisma.integrationToken.update({
      where: { provider: 'instagram' },
      data: { accessToken, expiresAt },
    })

    return NextResponse.json({ ok: true, expiresAt })
  } catch (error) {
    await sendAlert(
      `Instagram token yenileme başarısız oldu, ACİL müdahale gerekiyor: ${(error as Error).message}`
    )
    return NextResponse.json({ error: 'refresh_failed' }, { status: 500 })
  }
}
