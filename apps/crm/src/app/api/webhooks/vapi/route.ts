import { NextResponse, after } from 'next/server'
import { createLead, runQualification } from '@/lib/leads'

interface VapiEndOfCallBody {
  message?: {
    type?: string
    call?: { customer?: { number?: string } }
    analysis?: {
      summary?: string
      structuredData?: { name?: string; phone?: string; request?: string }
    }
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!process.env.VAPI_WEBHOOK_SECRET || token !== process.env.VAPI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await req.json()) as VapiEndOfCallBody
  const message = body.message

  if (message?.type !== 'end-of-call-report') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const structured = message.analysis?.structuredData ?? {}
  const callerNumber = message.call?.customer?.number ?? 'Bilinmiyor'
  const name = structured.name ?? 'Belirtilmedi'
  const phone = structured.phone ?? callerNumber
  const requestText = structured.request ?? message.analysis?.summary ?? 'Belirtilmedi'

  const lead = await createLead({
    name,
    phone,
    requestText,
    source: 'VAPI',
    sourceMeta: body as unknown,
  })
  after(() => runQualification(lead.id))

  return NextResponse.json({ id: lead.id }, { status: 201 })
}
