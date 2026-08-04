import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { safeUrl } from '@/lib/sections'
import { requireSession } from '@/lib/auth'

// Boş string ('') gönderildiğinde "değer yok" olarak kabul edilir; UI, doldurulmamış
// opsiyonel alanlar için '' gönderiyor, aksi halde safeUrl/.email() bunu reddederdi.
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v)
const optionalSafeUrl = z.preprocess(emptyToUndefined, safeUrl.optional().nullable())
const optionalEmail = z.preprocess(emptyToUndefined, z.string().email().optional().nullable())

const settingsSchema = z.object({
  siteTitle: z.string().min(1).max(200),
  metaDescription: z.string().min(1).max(2000),
  faviconUrl: optionalSafeUrl,
  logoUrl: optionalSafeUrl,
  instagramUrl: optionalSafeUrl,
  contactEmail: optionalEmail,
})

export async function GET() {
  const userId = await requireSession()
  if (!userId) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
  return NextResponse.json(settings)
}

export async function PATCH(req: Request) {
  const userId = await requireSession()
  if (!userId) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }
  const body = await req.json()
  const parsed = settingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
  }
  const data = {
    siteTitle: parsed.data.siteTitle,
    metaDescription: parsed.data.metaDescription,
    faviconUrl: parsed.data.faviconUrl || null,
    logoUrl: parsed.data.logoUrl || null,
    instagramUrl: parsed.data.instagramUrl || null,
    contactEmail: parsed.data.contactEmail || null,
  }
  const settings = await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  })
  return NextResponse.json(settings)
}
