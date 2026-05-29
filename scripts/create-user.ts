#!/usr/bin/env tsx
import bcrypt from "bcrypt";
import prisma from "../src/prismaClient";

async function main() {
  const username = process.env.NEW_USER_USERNAME ?? "testuser";
  const email = process.env.NEW_USER_EMAIL ?? "test@example.com";
  const password = process.env.NEW_USER_PASSWORD ?? "Password123!";

  try {
    // Ensure role exists
    let role = await prisma.role.findUnique({ where: { name: "user" } });

    if (!role) {
      role = await prisma.role.create({ data: { name: "user" } });
      console.log("Created role 'user' with id:", role.id);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();

    const existing = await prisma.user.findUnique({ where: { username } });

    if (existing) {
      const updatedUser = await prisma.user.update({
        where: { username },
        data: {
          email,
          passwordHash,
          emailVerified: true,
          emailVerifiedAt: now,
          pendingOtp: null,
          pendingOtpExpiresAt: null,
          resetToken: null,
          resetTokenExpiresAt: null,
        },
      });

      console.log("Updated existing user:", {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        emailVerified: updatedUser.emailVerified,
      });
      return;
    }

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        roleId: role.id,
        emailVerified: true,
        emailVerifiedAt: now,
      },
    });

    console.log("Created user:", { id: user.id, username: user.username, email: user.email, emailVerified: user.emailVerified });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
