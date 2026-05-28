import bcrypt from "bcrypt";
import prisma from "../src/prismaClient";

async function main() {
  const password = "admin12345";
  const permissionDefinitions = [
    { name: "artwork:create", description: "Create new artwork entries." },
    { name: "artwork:edit", description: "Edit existing artwork entries." },
    { name: "artwork:delete", description: "Delete artwork entries." },
    { name: "review:create", description: "Create artwork reviews." },
    { name: "review:delete", description: "Delete artwork reviews." },
    { name: "user:manage", description: "Manage user accounts and roles." },
    { name: "chat:use", description: "Access chat features." },
  ] as const;

  for (const permission of permissionDefinitions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      create: permission,
      update: { description: permission.description },
    });
  }

  const adminRole =
    (await prisma.role.upsert({
      where: { name: "admin" },
      create: {
        name: "admin",
        permissions: {
          connect: permissionDefinitions.map((permission) => ({ name: permission.name })),
        },
      },
      update: {
        permissions: {
          set: permissionDefinitions.map((permission) => ({ name: permission.name })),
        },
      },
    }))!;

  const user = await prisma.user.upsert({
    where: { username: "admin" },
    create: {
      username: "admin",
      email: "admin@artspace.com",
      passwordHash: await bcrypt.hash(password, 10),
      roleId: adminRole.id,
    },
    update: {
      email: "admin@artspace.com",
      passwordHash: await bcrypt.hash(password, 10),
      roleId: adminRole.id,
    },
  });

  console.log("Admin account synced:", {
    id: user.id,
    username: user.username,
    email: user.email,
    password,
  });

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
