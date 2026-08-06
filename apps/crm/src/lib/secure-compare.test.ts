import { describe, it, expect } from 'vitest'
import { secureCompare } from './secure-compare'

describe('secureCompare', () => {
  it('eşit dizeler için true döner', () => {
    expect(secureCompare('gizli-anahtar', 'gizli-anahtar')).toBe(true)
  })

  it('farklı dizeler için false döner', () => {
    expect(secureCompare('gizli-anahtar', 'baska-anahtar')).toBe(false)
  })

  it('farklı uzunluktaki dizeler için hata fırlatmadan false döner', () => {
    expect(secureCompare('kisa', 'cok-daha-uzun-bir-deger')).toBe(false)
  })

  it('boş dizeleri karşılaştırabilir', () => {
    expect(secureCompare('', '')).toBe(true)
  })
})
