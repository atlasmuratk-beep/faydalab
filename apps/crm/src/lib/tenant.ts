import { randomBytes } from 'crypto'
import { prisma } from './db'
import type { Tenant } from '@prisma/client'

const TRIAL_LENGTH_MS = 14 * 24 * 60 * 60 * 1000

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
  return base || 'isletme'
}

export async function createTenant(name: string): Promise<Tenant> {
  const base = slugify(name)
  let slug = base
  let attempt = 0
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    attempt += 1
    slug = `${base}-${attempt}`
  }

  return prisma.tenant.create({
    data: {
      name,
      slug,
      ingestSecret: randomBytes(32).toString('hex'),
      trialEndsAt: new Date(Date.now() + TRIAL_LENGTH_MS),
    },
  })
}
