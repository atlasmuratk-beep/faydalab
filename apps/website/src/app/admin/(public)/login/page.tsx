'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.get('username'),
        password: form.get('password'),
      }),
    })
    if (!res.ok) {
      const body = await res.json()
      setError(body.error ?? 'Giriş başarısız')
      return
    }
    router.push('/admin/sections')
    router.refresh()
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-brand-bg px-4">
      <h1 className="mb-6 font-heading text-3xl uppercase text-brand-text">Yönetim Paneli Girişi</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          name="username"
          placeholder="Kullanıcı adı"
          required
          className="rounded border border-brand-border bg-transparent p-3 text-brand-text"
        />
        <input
          name="password"
          type="password"
          placeholder="Şifre"
          required
          className="rounded border border-brand-border bg-transparent p-3 text-brand-text"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="rounded-full bg-brand-gold py-3 font-subheading font-semibold text-brand-bg hover:opacity-90"
        >
          Giriş Yap
        </button>
      </form>
    </div>
  )
}
