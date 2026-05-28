import { execSync } from "node:child_process";
import { prisma } from "../../src/prismaClient";
import { PrismaArtworkStore } from "../../src/prismaArtworkStore";

export function migrateTestDatabase() {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
    },
  });
}

export async function truncateTestDatabase() {
  await PrismaArtworkStore.flushPendingWrites();
  await prisma.$executeRawUnsafe('DELETE FROM "_PermissionToRole"');
  await prisma.review.deleteMany();
  await prisma.artwork.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
}

export async function disconnectTestDatabase() {
  await prisma.$disconnect();
}
