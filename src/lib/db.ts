import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Only log warnings/errors — logging every query floods dev.log and
    // adds I/O overhead on the hot search path. Enable query logging only
    // when explicitly debugging via the DEBUG_PRISMA_QUERIES env var.
    log:
      process.env.DEBUG_PRISMA_QUERIES === '1'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db