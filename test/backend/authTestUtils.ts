import bcrypt from "bcrypt";
import request from "supertest";
import type { Express } from "express";
import { prisma } from "../../src/prismaClient";

export type TestCredentials = {
  username: string;
  password: string;
  email: string;
};

const authPermissions = ["artwork:create", "artwork:edit", "artwork:delete"];

async function seedPermission(name: string) {
  return prisma.permission.create({
    data: {
      name,
      description: `${name} permission.`,
    },
  });
}

async function seedRole(name: string, permissionNames: string[] = []) {
  return prisma.role.create({
    data: {
      name,
      permissions: permissionNames.length
        ? {
            connect: permissionNames.map((permissionName) => ({ name: permissionName })),
          }
        : undefined,
    },
  });
}

export async function seedAuthPermissions() {
  for (const permissionName of authPermissions) {
    await seedPermission(permissionName);
  }
}

export async function seedStandardAuthUsers() {
  await seedAuthPermissions();
  const userCredentials: TestCredentials = {
    username: "alice",
    email: "alice@example.com",
    password: "user123",
  };

  await prisma.user.create({
    data: {
      username: userCredentials.username,
      email: userCredentials.email,
      passwordHash: await bcrypt.hash(userCredentials.password, 10),
      emailVerified: true,
      roleId: (await seedRole("user")).id,
    },
  });
  const adminCredentials: TestCredentials = {
    username: "admin",
    email: "admin@example.com",
    password: "admin12345",
  };

  await prisma.user.create({
    data: {
      username: adminCredentials.username,
      email: adminCredentials.email,
      passwordHash: await bcrypt.hash(adminCredentials.password, 10),
      emailVerified: true,
      roleId: (await seedRole("admin", authPermissions)).id,
    },
  });

  return {
    user: userCredentials,
    admin: adminCredentials,
  };
}

export async function seedRegisteredUser(username = "newuser") {
  await prisma.role.create({
    data: {
      name: "user",
    },
  });

  const credentials: TestCredentials = {
    username,
    email: `${username}@example.com`,
    password: "password123",
  };

  await prisma.user.create({
    data: {
      username: credentials.username,
      email: credentials.email,
      passwordHash: await bcrypt.hash(credentials.password, 10),
      emailVerified: true,
      roleId: (await prisma.role.findUniqueOrThrow({ where: { name: "user" } })).id,
    },
  });

  return credentials;
}

export async function seedRoleWithPermissions(name: string, permissionNames: string[] = []) {
  if (permissionNames.length > 0) {
    for (const permissionName of permissionNames) {
      await seedPermission(permissionName);
    }
  }

  return seedRole(name, permissionNames);
}

export async function completeMfaLogin(app: Express, credentials: TestCredentials) {
  const loginResponse = await request(app).post("/api/auth/login").send(credentials);

  await request(app)
    .post("/api/auth/login/send-otp")
    .send({ stepToken: loginResponse.body.stepToken as string });

  return request(app)
    .post("/api/auth/login/verify-otp")
    .send({ stepToken: loginResponse.body.stepToken as string, code: "123456" });
}
