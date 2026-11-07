import { PrismaClient } from '@prisma/client'
import { NAME_FIELDS, nameCaseData } from './name-case'

/**
 * Every create/update of a person or clinic name goes through here, so names
 * are stored with a capital first letter on each word whichever screen or
 * API saved them (see name-case.ts).
 */
function makeClient() {
  const base = new PrismaClient({ log: ['query'] })
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const fields = NAME_FIELDS[model.charAt(0).toLowerCase() + model.slice(1)]
          if (fields && args && typeof args === 'object') {
            const a = args as Record<string, unknown>
            if (operation === 'create' || operation === 'update' || operation === 'updateMany' || operation === 'updateManyAndReturn') {
              nameCaseData(a.data, fields)
            } else if (operation === 'createMany' || operation === 'createManyAndReturn') {
              const d = a.data
              if (Array.isArray(d)) d.forEach((row) => nameCaseData(row, fields))
              else nameCaseData(d, fields)
            } else if (operation === 'upsert') {
              nameCaseData(a.create, fields)
              nameCaseData(a.update, fields)
            }
          }
          return query(args)
        },
      },
    },
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Typed as the plain client: the extension only rewrites write arguments, so the
// API surface is unchanged and existing helpers that take a PrismaClient keep working.
export const db: PrismaClient = globalForPrisma.prisma ?? (makeClient() as unknown as PrismaClient)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
