import { describe, it, expect, vi } from 'vitest'
import { withRetry } from './with-retry'

describe('withRetry', () => {
  it('ilk denemede başarılı olursa tekrar denemez', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('ilk deneme başarısız olursa bir kez tekrar dener', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('ikinci deneme de başarısız olursa hatayı fırlatır', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('kalıcı hata'))
    await expect(withRetry(fn)).rejects.toThrow('kalıcı hata')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
