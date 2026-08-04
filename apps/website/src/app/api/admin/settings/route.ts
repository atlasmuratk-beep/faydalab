import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } })
  return NextResponse.json(settings)
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const data = {
    siteTitle: body.siteTitle,
    metaDescription: body.metaDescription,
    faviconUrl: body.faviconUrl || null,
    logoUrl: body.logoUrl || null,
    instagramUrl: body.instagramUrl || null,
    contactEmail: body.contactEmail || null,
  }
  const settings = await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  })
  return NextResponse.json(settings)
}
