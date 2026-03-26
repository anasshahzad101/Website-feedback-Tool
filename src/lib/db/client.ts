import { PrismaClient } from "@prisma/client";
import { bootstrapServerEnv } from "@/lib/env/server-env-bootstrap";

bootstrapServerEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export * from "@prisma/client";
