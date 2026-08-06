import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/session'

export const runtime = 'nodejs'

export function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const session = verifySession(token)
  if (!session) {
    if (req.nextUrl.pathname === '/admin/login') {
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
  matcher: ['/admin', '/admin/((?!login).*)', '/api/admin/:path*'],
}
