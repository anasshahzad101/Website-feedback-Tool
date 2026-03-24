import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Remove old seed users if they still exist
  const oldEmails = [
    "owner@speedxmarketing.com",
    "admin@speedxmarketing.com",
    "pm@speedxmarketing.com",
    "reviewer@speedxmarketing.com",
  ];
  for (const email of oldEmails) {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      await db.user.delete({ where: { id: existing.id } });
      console.log("Removed old user:", email);
    }
  }

  // Create Click Track owner (use string literal to avoid depending on generated enums at build time)
  const ownerPassword = await hash("admin123", 10);
  const owner = await db.user.upsert({
    where: { email: "anas@clicktrackmarketing.com" },
    update: { passwordHash: ownerPassword, isActive: true, role: "OWNER" },
    create: {
      email: "anas@clicktrackmarketing.com",
      firstName: "Anas",
      lastName: "Shahzad",
      passwordHash: ownerPassword,
      role: "OWNER",
      isActive: true,
    },
  });
  console.log("Owner user ready:", owner.email);

  console.log("\nSeed completed successfully!");
  console.log("\nLogin credentials:");
  console.log("- Owner: anas@clicktrackmarketing.com / admin123");
  console.log("(Change password after first login via Settings)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
