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
    const token = signSession('user-1')
    expect(verifySession(token)).toBe('user-1')
  })

  it('imzalanan token 3 parçadan oluşur: userId.issuedAt.sig', () => {
    const token = signSession('user-1')
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
    expect(parts[0]).toBe('user-1')
    expect(Number.isFinite(Number(parts[1]))).toBe(true)
  })

  it('değiştirilmiş (tamper edilmiş) token reddedilir', () => {
    const token = signSession('user-1')
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
    expect(verifySession(tampered)).toBeNull()
  })

  it('boş token null döner', () => {
    expect(verifySession(undefined)).toBeNull()
    expect(verifySession(null)).toBeNull()
  })

  it('yanlış parça sayısına sahip token null döner', () => {
    expect(verifySession('user-1.sig')).toBeNull()
    expect(verifySession('user-1.123.extra.sig')).toBeNull()
  })

  it('süresi dolmuş (30 günden eski) token reddedilir', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now - 31 * 24 * 60 * 60 * 1000)
    const token = signSession('user-1')
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(verifySession(token)).toBeNull()
  })

  it('süresi henüz dolmamış (30 gün içindeki) token kabul edilir', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now - 29 * 24 * 60 * 60 * 1000)
    const token = signSession('user-1')
    vi.spyOn(Date, 'now').mockReturnValue(now)
    expect(verifySession(token)).toBe('user-1')
  })

  it('ADMIN_SESSION_SECRET tanımlı değilse hata fırlatır', () => {
    delete process.env.ADMIN_SESSION_SECRET
    expect(() => signSession('user-1')).toThrow('ADMIN_SESSION_SECRET')
  })
})
