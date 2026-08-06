import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/session'

export const runtime = 'nodejs'

const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/admin/signup'])

export function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = verifySession(token)
  if (!session) {
    if (PUBLIC_ADMIN_PATHS.has(req.nextUrl.pathname)) {
      return NextResponse.next()
    }
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/((?!login|signup).*)', '/api/admin/:path*'],
}
