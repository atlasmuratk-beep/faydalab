// Basit bellek-içi rate limit. NOT: Bu çözüm sunucusuz/çoklu instance (ör. Vercel
// serverless fonksiyonları) ortamlarında her instance kendi belleğini tuttuğu için
// sınırlı etkilidir — gerçek dağıtık rate limit için Redis/Upstash gibi paylaşımlı bir
// depo gerekir. MVP kapsamında YAGNI gereği bu basit çözüm yeterli kabul edildi.
const attempts = new Map<string, number[]>()

export function isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now()
  const timestamps = (attempts.get(key) ?? []).filter((t) => now - t < windowMs)
  timestamps.push(now)
  attempts.set(key, timestamps)
  return timestamps.length > maxAttempts
}
