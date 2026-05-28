import bcrypt from "bcrypt";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/backend/app";
import { requireAuth, requirePermission } from "../../src/middleware/requireAuth";
import { prisma } from "../../src/prismaClient";
import { generateAccessToken } from "../../src/utils/jwt";
import { generateTotpSecret, generateTotpToken } from "../../src/utils/totp";
import {
  disconnectTestDatabase,
  migrateTestDatabase,
  truncateTestDatabase,
} from "./dbTestUtils";

vi.mock("../../src/utils/mailer", () => ({
  sendEmail: vi.fn(async () => undefined),
}));

vi.mock("../../src/utils/emailOtp", async () => {
  const actual = await vi.importActual<typeof import("../../src/utils/emailOtp")>("../../src/utils/emailOtp");

  return {
    ...actual,
    generateOtpCode: () => "123456",
  };
});

async function seedAuthFixtures(options: { otpEnabled?: boolean; otpSecret?: string; emailVerified?: boolean } = {}) {
  const permissions = ["artwork:create", "artwork:delete"];

  for (const name of permissions) {
    await prisma.permission.create({
      data: {
        name,
        description: `${name} permission.`,
      },
    });
  }

  const password = "password123";

  await prisma.user.create({
    data: {
      username: "jane",
      email: "jane@example.com",
      passwordHash: await bcrypt.hash(password, 10),
      emailVerified: options.emailVerified ?? true,
      otpEnabled: options.otpEnabled ?? false,
      otpSecret: options.otpSecret,
      role: {
        create: {
          name: "editor",
          permissions: {
            connect: [{ name: "artwork:create" }],
          },
        },
      },
    },
  });

  return { username: "jane", password };
}

async function completePasswordAndEmailOtpLogin(app: express.Express, credentials: { username: string; password: string }) {
  const loginResponse = await request(app).post("/api/auth/login").send(credentials);

  expect(loginResponse.status).toBe(200);
  expect(loginResponse.body.success).toBe(true);
  expect(loginResponse.body.stepToken).toEqual(expect.any(String));
  expect(loginResponse.body.requiresEmailOtp).toBe(true);

  const sendOtpResponse = await request(app)
    .post("/api/auth/login/send-otp")
    .send({ stepToken: loginResponse.body.stepToken });

  expect(sendOtpResponse.status).toBe(200);
  expect(sendOtpResponse.body.success).toBe(true);

  const verifyOtpResponse = await request(app)
    .post("/api/auth/login/verify-otp")
    .send({ stepToken: loginResponse.body.stepToken, code: "123456" });

  expect(verifyOtpResponse.status).toBe(200);
  return verifyOtpResponse;
}

describe("auth routes", () => {
  beforeAll(() => {
    migrateTestDatabase();
  });

  beforeEach(async () => {
    await truncateTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("registers, logs in through the MFA flow, refreshes, and returns the current user", async () => {
    const credentials = await seedAuthFixtures();
    const { app } = createApp({ seed: [] });
    await prisma.role.create({ data: { name: "user" } });

    const registerResponse = await request(app).post("/api/auth/register").send({
      username: "newuser",
      email: "newuser@example.com",
      password: "password123",
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.success).toBe(true);
    expect(registerResponse.body.user).toMatchObject({
      username: "newuser",
      email: "newuser@example.com",
      role: "user",
    });

    const loginResponse = await completePasswordAndEmailOtpLogin(app, credentials);

    expect(loginResponse.body.user).toMatchObject({
      username: credentials.username,
      email: "jane@example.com",
      role: "editor",
    });

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.success).toBe(true);
    expect(meResponse.body.user.username).toBe(credentials.username);
    expect(meResponse.body.user.permissions).toEqual(["artwork:create"]);

    const refreshCookie = (loginResponse.headers["set-cookie"] as string[])[0].split(";")[0];
    const refreshResponse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refreshCookie);

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
  });

  it("requires TOTP for users who enabled it", async () => {
    const secret = generateTotpSecret();
    const credentials = await seedAuthFixtures({ otpEnabled: true, otpSecret: secret });
    const { app } = createApp({ seed: [] });

    const loginResponse = await request(app).post("/api/auth/login").send(credentials);
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.requiresTotp).toBe(true);

    await request(app).post("/api/auth/login/send-otp").send({ stepToken: loginResponse.body.stepToken });

    const verifyOtpResponse = await request(app)
      .post("/api/auth/login/verify-otp")
      .send({ stepToken: loginResponse.body.stepToken, code: "123456" });

    expect(verifyOtpResponse.status).toBe(200);
    expect(verifyOtpResponse.body.requiresTotp).toBe(true);
    expect(verifyOtpResponse.body.stepToken).toEqual(expect.any(String));

    const totpToken = await generateTotpToken(secret);
    const verifyTotpResponse = await request(app)
      .post("/api/auth/login/verify-totp")
      .send({ stepToken: verifyOtpResponse.body.stepToken, token: totpToken });

    expect(verifyTotpResponse.status).toBe(200);
    expect(verifyTotpResponse.body.accessToken).toEqual(expect.any(String));
  });

  it("rejects invalid credentials", async () => {
    await seedAuthFixtures();
    const { app } = createApp({ seed: [] });

    const response = await request(app).post("/api/auth/login").send({
      username: "jane",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid credentials");
  });

  it("rejects login before email verification", async () => {
    await seedAuthFixtures({ emailVerified: false });
    const { app } = createApp({ seed: [] });

    const response = await request(app).post("/api/auth/login").send({
      username: "jane",
      password: "password123",
    });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Email verification required");
  });

  it("logs out and clears the session", async () => {
    const credentials = await seedAuthFixtures();
    const { app } = createApp({ seed: [] });
    const loginResponse = await completePasswordAndEmailOtpLogin(app, credentials);
    const refreshCookie = (loginResponse.headers["set-cookie"] as string[])[0].split(";")[0];

    const logoutResponse = await request(app).post("/api/auth/logout").set("Cookie", refreshCookie);
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.success).toBe(true);
    expect((logoutResponse.headers["set-cookie"] as string[])[0]).toContain("refreshToken=");
  });

  it("enforces auth and permission middleware", async () => {
    const testApp = express();
    testApp.use(express.json());

    testApp.get(
      "/api/protected",
      requireAuth,
      requirePermission("artwork:delete"),
      (_req, res) => {
        return res.status(200).json({ success: true });
      },
    );

    const anonymousResponse = await request(testApp).get("/api/protected");
    expect(anonymousResponse.status).toBe(401);

    const accessToken = generateAccessToken({
      id: "user-1",
      username: "jane",
      email: "jane@example.com",
      role: "editor",
      permissions: ["artwork:create"],
    });

    const forbiddenResponse = await request(testApp)
      .get("/api/protected")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(forbiddenResponse.status).toBe(403);
  });
});
