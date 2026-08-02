import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { verifyInternalAuthHeader, verifyTelegramWebhookSecret } from './auth'

describe('verifyInternalAuthHeader', () => {
  const originalSecret = process.env.INTERNAL_API_SECRET

  beforeEach(() => {
    delete process.env.INTERNAL_API_SECRET
  })

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.INTERNAL_API_SECRET
    } else {
      process.env.INTERNAL_API_SECRET = originalSecret
    }
  })

  it('doğru secret ayarlıyken doğru header için true döner', () => {
    process.env.INTERNAL_API_SECRET = 'test-secret'
    expect(verifyInternalAuthHeader('Bearer test-secret')).toBe(true)
  })

  it('doğru secret ayarlıyken yanlış header için false döner', () => {
    process.env.INTERNAL_API_SECRET = 'test-secret'
    expect(verifyInternalAuthHeader('Bearer wrong-secret')).toBe(false)
  })

  it('secret tanımsızken "Bearer undefined" header için false döner (bypass koruması)', () => {
    delete process.env.INTERNAL_API_SECRET
    expect(verifyInternalAuthHeader('Bearer undefined')).toBe(false)
  })

  it('secret boş string iken "Bearer " header için false döner', () => {
    process.env.INTERNAL_API_SECRET = ''
    expect(verifyInternalAuthHeader('Bearer ')).toBe(false)
  })

  it('secret tanımsızken header hiç yokken false döner', () => {
    delete process.env.INTERNAL_API_SECRET
    expect(verifyInternalAuthHeader(null)).toBe(false)
  })

  it('secret ayarlıyken header hiç yokken false döner', () => {
    process.env.INTERNAL_API_SECRET = 'test-secret'
    expect(verifyInternalAuthHeader(null)).toBe(false)
  })
})

describe('verifyTelegramWebhookSecret', () => {
  const originalSecret = process.env.TELEGRAM_WEBHOOK_SECRET

  beforeEach(() => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET
  })

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.TELEGRAM_WEBHOOK_SECRET
    } else {
      process.env.TELEGRAM_WEBHOOK_SECRET = originalSecret
    }
  })

  it('doğru secret ayarlıyken doğru param için true döner', () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret'
    expect(verifyTelegramWebhookSecret('test-secret')).toBe(true)
  })

  it('doğru secret ayarlıyken yanlış param için false döner', () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret'
    expect(verifyTelegramWebhookSecret('wrong-secret')).toBe(false)
  })

  it('secret tanımsızken "undefined" param için false döner (bypass koruması)', () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET
    expect(verifyTelegramWebhookSecret('undefined')).toBe(false)
  })

  it('secret tanımsızken param hiç yokken false döner', () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET
    expect(verifyTelegramWebhookSecret(null)).toBe(false)
  })

  it('secret ayarlıyken param hiç yokken false döner', () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret'
    expect(verifyTelegramWebhookSecret(null)).toBe(false)
  })
})
