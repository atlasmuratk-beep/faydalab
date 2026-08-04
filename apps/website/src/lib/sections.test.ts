import { describe, it, expect } from 'vitest'
import { validateSectionContent } from './sections'

describe('validateSectionContent', () => {
  it('geçerli HERO içeriğini kabul eder', () => {
    const result = validateSectionContent('HERO', {
      title: 'Başlık',
      subtitle: 'Alt başlık',
      ctaText: 'Tıkla',
      ctaLink: '#iletisim',
    })
    expect(result.success).toBe(true)
  })

  it('eksik alanlı HERO içeriğini reddeder', () => {
    const result = validateSectionContent('HERO', { title: 'Başlık' })
    expect(result.success).toBe(false)
  })

  it('geçerli SERVICES içeriğini kabul eder', () => {
    const result = validateSectionContent('SERVICES', {
      title: 'Hizmetler',
      items: [{ icon: '🤖', name: 'AI', description: 'açıklama' }],
    })
    expect(result.success).toBe(true)
  })

  it('boş items listesi olan SERVICES içeriğini reddeder', () => {
    const result = validateSectionContent('SERVICES', { title: 'Hizmetler', items: [] })
    expect(result.success).toBe(false)
  })

  it('geçerli CASE_STUDY içeriğini kabul eder', () => {
    const result = validateSectionContent('CASE_STUDY', {
      projectName: 'Proje',
      needText: 'ihtiyaç',
      solutionText: 'çözüm',
      resultText: 'sonuç',
      imageUrl: 'https://example.com/img.jpg',
      liveUrl: 'https://example.com',
    })
    expect(result.success).toBe(true)
  })

  it('geçersiz URL alanlı CASE_STUDY içeriğini reddeder', () => {
    const result = validateSectionContent('CASE_STUDY', {
      projectName: 'Proje',
      needText: 'ihtiyaç',
      solutionText: 'çözüm',
      resultText: 'sonuç',
      imageUrl: 'not-a-url',
      liveUrl: 'https://example.com',
    })
    expect(result.success).toBe(false)
  })

  it('javascript: şemalı liveUrl içeren CASE_STUDY içeriğini reddeder', () => {
    const result = validateSectionContent('CASE_STUDY', {
      projectName: 'Proje',
      needText: 'ihtiyaç',
      solutionText: 'çözüm',
      resultText: 'sonuç',
      imageUrl: 'https://example.com/img.jpg',
      liveUrl: 'javascript:alert(1)',
    })
    expect(result.success).toBe(false)
  })

  it('data: şemalı imageUrl içeren CASE_STUDY içeriğini reddeder', () => {
    const result = validateSectionContent('CASE_STUDY', {
      projectName: 'Proje',
      needText: 'ihtiyaç',
      solutionText: 'çözüm',
      resultText: 'sonuç',
      imageUrl: 'data:text/html,<script>alert(1)</script>',
      liveUrl: 'https://example.com',
    })
    expect(result.success).toBe(false)
  })

  it('geçerli TEXT_BLOCK içeriğini kabul eder', () => {
    const result = validateSectionContent('TEXT_BLOCK', { title: 'Başlık', bodyMarkdown: 'metin' })
    expect(result.success).toBe(true)
  })

  it('geçerli CONTACT içeriğini kabul eder', () => {
    const result = validateSectionContent('CONTACT', { title: 'İletişim', subtitle: 'Bize ulaşın' })
    expect(result.success).toBe(true)
  })
})
