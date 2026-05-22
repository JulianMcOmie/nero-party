import { PrismaClient } from "@prisma/client";

/**
 * Single shared PrismaClient. `tsx watch` reloads the module on every save,
 * so we cache the instance on `globalThis` to avoid exhausting the SQLite
 * connection pool during development.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
