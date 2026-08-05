'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { ContactContent } from '@/lib/sections'
import { Reveal } from '@/components/motion/Reveal'

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
    'rounded-lg border border-brand-border bg-brand-bg p-3 text-brand-text placeholder:text-brand-muted/60 outline-none transition focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/20'

  return (
    <section id="iletisim" className="scroll-mt-20 border-t border-brand-border px-6 py-28">
      <div className="mx-auto grid max-w-5xl gap-14 md:grid-cols-2 md:items-center">
        <Reveal>
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-8 bg-brand-gold" />
            <span className="font-subheading text-xs uppercase tracking-[0.3em] text-brand-muted">İletişim</span>
          </div>
          <h2 className="mb-4 font-heading text-4xl uppercase leading-tight text-brand-text md:text-5xl">
            {content.title}
          </h2>
          <p className="max-w-sm text-brand-muted">{content.subtitle}</p>
        </Reveal>
        <Reveal delay={0.1} className="rounded-2xl border border-brand-border bg-brand-surface p-7 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.9)]">
          {status === 'sent' ? (
            <motion.p
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 p-4 text-brand-gold"
            >
              Mesajınız alındı, en kısa sürede dönüş yapacağız.
            </motion.p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
              <input name="name" placeholder="İsim" required className={inputClass} />
              <input name="email" type="email" placeholder="E-posta" required className={inputClass} />
              <textarea name="message" placeholder="Mesajınız" required rows={4} className={inputClass} />
              {status === 'error' && <p className="text-sm text-red-400">Gönderim başarısız, lütfen tekrar deneyin.</p>}
              <motion.button
                type="submit"
                disabled={status === 'sending'}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="rounded-full bg-brand-gold px-8 py-3 font-subheading font-semibold text-brand-bg transition-shadow hover:shadow-[0_8px_30px_-10px_rgba(212,175,55,0.5)] disabled:opacity-50"
              >
                {status === 'sending' ? 'Gönderiliyor...' : 'Gönder'}
              </motion.button>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  )
}
