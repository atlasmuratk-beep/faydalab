import { NextResponse, after } from 'next/server'
import { createLeadSchema, createLead, runQualification } from '@/lib/leads'
import { secureCompare } from '@/lib/secure-compare'

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
  // Header tercih edilir (URL'ler sunucu erişim loglarında düz metin olarak kalabilir);
  // query param, Vapi'nin şu anki webhook yapılandırmasıyla geriye dönük uyumluluk için korunur.
  const token = req.headers.get('x-vapi-webhook-secret') ?? url.searchParams.get('token')
  const expected = process.env.VAPI_WEBHOOK_SECRET
  if (!expected || !token || !secureCompare(token, expected)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: VapiEndOfCallBody
  try {
    body = (await req.json()) as VapiEndOfCallBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const message = body.message

  if (message?.type !== 'end-of-call-report') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  const structured = message.analysis?.structuredData ?? {}
  const callerNumber = message.call?.customer?.number ?? 'Bilinmiyor'
  const name = structured.name ?? 'Belirtilmedi'
  const phone = structured.phone ?? callerNumber
  const requestText = structured.request ?? message.analysis?.summary ?? 'Belirtilmedi'

  const parsed = createLeadSchema.safeParse({
    name,
    phone,
    requestText,
    source: 'VAPI',
    sourceMeta: body as unknown,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_lead_data', details: parsed.error.flatten() }, { status: 400 })
  }

  const lead = await createLead(parsed.data)
  after(() => runQualification(lead.id))

  return NextResponse.json({ id: lead.id }, { status: 201 })
}
