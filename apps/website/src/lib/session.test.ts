import { describe, it, expect, beforeEach } from 'vitest'
import { signSession, verifySession } from './session'

describe('session', () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = 'test-secret'
  })

  it('imzalanan bir token doğru şekilde doğrulanır', () => {
    const token = signSession('user-1')
    expect(verifySession(token)).toBe('user-1')
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

  it('ADMIN_SESSION_SECRET tanımlı değilse hata fırlatır', () => {
    delete process.env.ADMIN_SESSION_SECRET
    expect(() => signSession('user-1')).toThrow('ADMIN_SESSION_SECRET')
  })
})
