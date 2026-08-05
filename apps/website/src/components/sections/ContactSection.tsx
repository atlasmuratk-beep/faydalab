'use client'

import { useState } from 'react'
import type { ContactContent } from '@/lib/sections'

export function ContactSection({ content }: { content: ContactContent }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    const formElement = e.currentTarget
    const form = new FormData(formElement)
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        email: form.get('email'),
        message: form.get('message'),
      }),
    })
    if (res.ok) {
      setStatus('sent')
      formElement.reset()
    } else {
      setStatus('error')
    }
  }

  const inputClass =
    'rounded-lg border border-brand-border bg-brand-surface p-3 text-brand-text placeholder:text-brand-muted/60 outline-none transition focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/20'

  return (
    <section id="iletisim" className="scroll-mt-20 border-t border-brand-border px-6 py-24">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="mb-2 font-heading text-4xl uppercase text-brand-text">{content.title}</h2>
        <p className="mb-8 text-brand-muted">{content.subtitle}</p>
        {status === 'sent' ? (
          <p className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 p-4 text-brand-gold">
            Mesajınız alındı, en kısa sürede dönüş yapacağız.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
            <input name="name" placeholder="İsim" required className={inputClass} />
            <input name="email" type="email" placeholder="E-posta" required className={inputClass} />
            <textarea name="message" placeholder="Mesajınız" required rows={4} className={inputClass} />
            {status === 'error' && <p className="text-sm text-red-400">Gönderim başarısız, lütfen tekrar deneyin.</p>}
            <button
              type="submit"
              disabled={status === 'sending'}
              className="rounded-full bg-brand-gold px-8 py-3 font-subheading font-semibold text-brand-bg shadow-[0_0_40px_-8px_rgba(212,175,55,0.6)] transition hover:-translate-y-0.5 hover:opacity-90 disabled:translate-y-0 disabled:opacity-50"
            >
              {status === 'sending' ? 'Gönderiliyor...' : 'Gönder'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
