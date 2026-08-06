import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { signSession, verifySession } from './session'

describe('session', () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = 'test-secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('imzalanan bir token doğru şekilde doğrulanır', () => {
    const token = signSession('user-1', 'tenant-1')
    expect(verifySession(token)).toEqual({ userId: 'user-1', tenantId: 'tenant-1' })
  })

  it('değiştirilmiş (tamper edilmiş) token reddedilir', () => {
    const token = signSession('user-1', 'tenant-1')
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
    expect(verifySession(tampered)).toBeNull()
  })

  it('boş token null döner', () => {
    expect(verifySession(undefined)).toBeNull()
    expect(verifySession(null)).toBeNull()
  })

  it('süresi dolmuş (30 günden eski) token reddedilir', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now - 31 * 24 * 60 * 60 * 1000)
    const token = signSession('user-1', 'tenant-1')
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(verifySession(token)).toBeNull()
  })

  it('ADMIN_SESSION_SECRET tanımlı değilse hata fırlatır', () => {
    delete process.env.ADMIN_SESSION_SECRET
    expect(() => signSession('user-1', 'tenant-1')).toThrow('ADMIN_SESSION_SECRET')
  })

  it('3 parçalı (eski formatlı) token reddedilir', () => {
    expect(verifySession('user-1.1234567890.deadbeef')).toBeNull()
  })
})
