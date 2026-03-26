import { PrismaClient } from "@prisma/client";
import { ensureMysqlDatabaseUrlEnv } from "./database-url";

ensureMysqlDatabaseUrlEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export * from "@prisma/client";
