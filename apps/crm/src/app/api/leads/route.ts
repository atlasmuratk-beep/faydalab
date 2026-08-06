import { NextResponse, after } from 'next/server'
import { createLeadSchema, createLead, runQualification } from '@/lib/leads'
import { isRateLimited } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const secret = req.headers.get('x-crm-ingest-secret')
  if (!process.env.CRM_INGEST_SECRET || secret !== process.env.CRM_INGEST_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ?? 'unknown'
  if (isRateLimited(ip, 20, 60_000)) {
    return NextResponse.json({ error: 'Çok fazla istek' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = createLeadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 })
  }

  const lead = await createLead(parsed.data)
  after(() => runQualification(lead.id))

  return NextResponse.json({ id: lead.id }, { status: 201 })
}
