import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const settingsSchema = z.object({
  siteTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  faviconUrl: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  instagramUrl: z.string().optional().nullable(),
  contactEmail: z.string().optional().nullable(),
})

export async function GET() {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
  return NextResponse.json(settings)
}

export async function PATCH(req: Request) {
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
