import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { requireSession } from '@/lib/auth'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 8 * 1024 * 1024

export async function POST(req: Request) {
  const userId = await requireSession()
  if (!userId) {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 })
  }
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Dosya bulunamadı' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Sadece JPEG, PNG, WEBP veya GIF yüklenebilir' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Dosya çok büyük (maksimum 8MB)' }, { status: 400 })
  }
  const blob = await put(`faydalab-website/${Date.now()}-${file.name}`, file, { access: 'public' })
  return NextResponse.json({ url: blob.url })
}
