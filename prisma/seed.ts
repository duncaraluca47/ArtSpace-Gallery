import { seedArtworks } from "../src/backend/data/seedArtworks.ts";
import bcrypt from "bcrypt";
import { prisma } from "../src/prismaClient.ts";

async function main() {
  const permissionDefinitions = [
    {
      name: "artwork:create",
      description: "Create new artwork entries.",
    },
    {
      name: "artwork:edit",
      description: "Edit existing artwork entries.",
    },
    {
      name: "artwork:delete",
      description: "Delete artwork entries.",
    },
    {
      name: "review:create",
      description: "Create artwork reviews.",
    },
    {
      name: "review:delete",
      description: "Delete artwork reviews.",
    },
    {
      name: "user:manage",
      description: "Manage user accounts and roles.",
    },
    {
      name: "chat:use",
      description: "Access chat features.",
    },
  ] as const;

  for (const permission of permissionDefinitions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      create: {
        name: permission.name,
        description: permission.description,
      },
      update: {
        description: permission.description,
      },
    });
  }

  const allPermissionNames = permissionDefinitions.map((permission) => permission.name);
  const userPermissionNames = ["artwork:create", "review:create", "chat:use"];

  await prisma.role.upsert({
    where: { name: "admin" },
    create: {
      name: "admin",
      permissions: {
        connect: allPermissionNames.map((name) => ({ name })),
      },
    },
    update: {
      permissions: {
        set: allPermissionNames.map((name) => ({ name })),
      },
    },
  });

  await prisma.role.upsert({
    where: { name: "user" },
    create: {
      name: "user",
      permissions: {
        connect: userPermissionNames.map((name) => ({ name })),
      },
    },
    update: {
      permissions: {
        set: userPermissionNames.map((name) => ({ name })),
      },
    },
  });

  await prisma.user.upsert({
    where: { username: "admin" },
    create: {
      username: "admin",
      email: "admin@artspace.com",
      passwordHash: bcrypt.hashSync("admin12345", 10),
      emailVerified: true,
      emailVerifiedAt: new Date(),
      role: { connect: { name: "admin" } },
    },
    update: {
      email: "admin@artspace.com",
      passwordHash: bcrypt.hashSync("admin12345", 10),
      emailVerified: true,
      emailVerifiedAt: new Date(),
      role: { connect: { name: "admin" } },
    },
  });

  await prisma.user.upsert({
    where: { username: "alice" },
    create: {
      username: "alice",
      email: "alice@artspace.com",
      passwordHash: bcrypt.hashSync("user123", 10),
      emailVerified: true,
      emailVerifiedAt: new Date(),
      role: { connect: { name: "user" } },
    },
    update: {
      email: "alice@artspace.com",
      passwordHash: bcrypt.hashSync("user123", 10),
      emailVerified: true,
      emailVerifiedAt: new Date(),
      role: { connect: { name: "user" } },
    },
  });

  for (const [index, artwork] of seedArtworks.entries()) {
    const id = String(index + 1);

    await prisma.artwork.upsert({
      where: { id },
      create: {
        id,
        title: artwork.title,
        artist: artwork.artist,
        year: artwork.year,
        medium: artwork.category,
        description: artwork.description,
        imageUrl: artwork.imageUrl,
        price: artwork.price,
        forSale: true,
        likes: artwork.likes ?? 0,
      },
      update: {
        title: artwork.title,
        artist: artwork.artist,
        year: artwork.year,
        medium: artwork.category,
        description: artwork.description,
        imageUrl: artwork.imageUrl,
        price: artwork.price,
        forSale: true,
        likes: artwork.likes ?? 0,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });