import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL ve ADMIN_PASSWORD .env dosyasında tanımlı olmalı')
  }

  const ingestSecret = randomBytes(32).toString('hex')

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'faydalab' },
    create: {
      name: 'FaydaLab',
      slug: 'faydalab',
      plan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      ingestSecret,
    },
    update: {},
  })

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.adminUser.upsert({
    where: { email },
    create: { email, passwordHash, tenantId: tenant.id },
    update: { passwordHash },
  })

  console.log(`Seed tamamlandı. Tenant ingestSecret: ${tenant.ingestSecret}`)
}

main().finally(() => prisma.$disconnect())
