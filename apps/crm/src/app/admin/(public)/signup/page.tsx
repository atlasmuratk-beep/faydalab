'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: form.get('businessName'),
        email: form.get('email'),
        password: form.get('password'),
      }),
    })
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Kayıt başarısız')
      return
    }
    router.push('/admin/leads')
    router.refresh()
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold uppercase text-brand-text">FaydaLab CRM&apos;e Kaydol</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          name="businessName"
          placeholder="İşletme adı"
          required
          className="rounded border border-brand-border bg-transparent p-3 text-brand-text"
        />
        <input
          name="email"
          type="email"
          placeholder="E-posta"
          required
          className="rounded border border-brand-border bg-transparent p-3 text-brand-text"
        />
        <input
          name="password"
          type="password"
          placeholder="Şifre (en az 8 karakter)"
          required
          minLength={8}
          className="rounded border border-brand-border bg-transparent p-3 text-brand-text"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="rounded-full bg-brand-gold py-3 font-semibold text-brand-bg hover:opacity-90"
        >
          14 Gün Ücretsiz Dene
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-brand-muted">
        Zaten hesabın var mı?{' '}
        <Link href="/admin/login" className="text-brand-gold underline">
          Giriş yap
        </Link>
      </p>
    </div>
  )
}
