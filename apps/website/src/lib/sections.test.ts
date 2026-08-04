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

  it('javascript: şemalı ctaLink içeren HERO içeriğini reddeder', () => {
    const result = validateSectionContent('HERO', {
      title: 'Başlık',
      subtitle: 'Alt başlık',
      ctaText: 'Tıkla',
      ctaLink: 'javascript:alert(1)',
    })
    expect(result.success).toBe(false)
  })

  it('/ ile başlayan yol ctaLink içeren HERO içeriğini kabul eder', () => {
    const result = validateSectionContent('HERO', {
      title: 'Başlık',
      subtitle: 'Alt başlık',
      ctaText: 'Tıkla',
      ctaLink: '/iletisim',
    })
    expect(result.success).toBe(true)
  })

  it('https URL ctaLink içeren HERO içeriğini kabul eder', () => {
    const result = validateSectionContent('HERO', {
      title: 'Başlık',
      subtitle: 'Alt başlık',
      ctaText: 'Tıkla',
      ctaLink: 'https://example.com',
    })
    expect(result.success).toBe(true)
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

  it('200 karakteri aşan HERO title alanını reddeder', () => {
    const result = validateSectionContent('HERO', {
      title: 'a'.repeat(201),
      subtitle: 'Alt başlık',
      ctaText: 'Tıkla',
      ctaLink: '#iletisim',
    })
    expect(result.success).toBe(false)
  })

  it('2000 karakteri aşan HERO subtitle alanını reddeder', () => {
    const result = validateSectionContent('HERO', {
      title: 'Başlık',
      subtitle: 'a'.repeat(2001),
      ctaText: 'Tıkla',
      ctaLink: '#iletisim',
    })
    expect(result.success).toBe(false)
  })

  it('2000 karakteri aşan CASE_STUDY needText alanını reddeder', () => {
    const result = validateSectionContent('CASE_STUDY', {
      projectName: 'Proje',
      needText: 'a'.repeat(2001),
      solutionText: 'çözüm',
      resultText: 'sonuç',
      imageUrl: 'https://example.com/img.jpg',
      liveUrl: 'https://example.com',
    })
    expect(result.success).toBe(false)
  })

  it('2000 karakteri aşan TEXT_BLOCK bodyMarkdown alanını reddeder', () => {
    const result = validateSectionContent('TEXT_BLOCK', { title: 'Başlık', bodyMarkdown: 'a'.repeat(2001) })
    expect(result.success).toBe(false)
  })
})
