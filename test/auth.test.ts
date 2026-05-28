import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/backend/app";
import { prisma } from "../src/prismaClient";
import { generateAccessToken } from "../src/utils/jwt";
import {
  disconnectTestDatabase,
  migrateTestDatabase,
  truncateTestDatabase,
} from "./backend/dbTestUtils";
import {
  seedRegisteredUser,
  seedRoleWithPermissions,
  seedStandardAuthUsers,
} from "./backend/authTestUtils";

const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn(async () => ({ messageId: "test-message" })),
}));

vi.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
  createTransport: vi.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

vi.mock("../src/utils/emailOtp", async () => {
  const actual = await vi.importActual<typeof import("../src/utils/emailOtp")>("../src/utils/emailOtp");

  return {
    ...actual,
    generateOtpCode: () => "123456",
  };
});

function getRefreshCookie(response: { headers: { [key: string]: unknown } }) {
  const setCookie = response.headers["set-cookie"] as string[] | undefined;
  return setCookie?.[0]?.split(";")[0] ?? "";
}

function getLastResetEmailText() {
  const call = mockSendMail.mock.calls.at(-1);
  return typeof call?.[0]?.text === "string" ? (call[0].text as string) : "";
}

function getResetTokenFromEmail() {
  const emailText = getLastResetEmailText();
  const match = emailText.match(/token=([a-f0-9]+)&email=/i);
  return match?.[1] ?? "";
}

function createExpiredToken() {
  const secret = process.env.JWT_SECRET ?? "supersecretkey_change_in_production";

  return jwt.sign(
    {
      id: "expired-user",
      username: "expired",
      email: "expired@example.com",
      role: "user",
      permissions: [],
      tokenType: "access" as const,
    },
    secret,
    { expiresIn: "-1h" },
  );
}

async function completeLogin(app: ReturnType<typeof createApp>["app"], credentials: { username: string; password: string }) {
  const loginResponse = await request(app).post("/api/auth/login").send(credentials);
  const sendOtpResponse = await request(app)
    .post("/api/auth/login/send-otp")
    .send({ stepToken: loginResponse.body.stepToken as string });

  expect(loginResponse.status).toBe(200);
  expect(sendOtpResponse.status).toBe(200);

  const verifyOtpResponse = await request(app)
    .post("/api/auth/login/verify-otp")
    .send({ stepToken: loginResponse.body.stepToken as string, code: "123456" });

  expect(verifyOtpResponse.status).toBe(200);
  return verifyOtpResponse;
}

describe("authentication and authorization", () => {
  beforeAll(() => {
    migrateTestDatabase();
  });

  beforeEach(async () => {
    await truncateTestDatabase();
    mockSendMail.mockClear();
  });

  afterEach(async () => {
    await truncateTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("registers a user and omits password hashes from the response", async () => {
    await seedRoleWithPermissions("user");
    const { app } = createApp({ seed: [] });

    const response = await request(app).post("/api/auth/register").send({
      username: "newuser",
      email: "newuser@example.com",
      password: "password123",
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.user).toMatchObject({
      username: "newuser",
      email: "newuser@example.com",
      role: "user",
    });
    expect(response.body).not.toHaveProperty("passwordHash");
  });

  it("rejects duplicate usernames and emails during registration", async () => {
    await seedRegisteredUser("existing");
    const { app } = createApp({ seed: [] });

    const duplicateUsername = await request(app).post("/api/auth/register").send({
      username: "existing",
      email: "different@example.com",
      password: "password123",
    });
    expect(duplicateUsername.status).toBe(409);

    const duplicateEmail = await request(app).post("/api/auth/register").send({
      username: "different",
      email: "existing@example.com",
      password: "password123",
    });
    expect(duplicateEmail.status).toBe(409);
  });

  it("validates registration payloads", async () => {
    await seedRoleWithPermissions("user");
    const { app } = createApp({ seed: [] });

    const shortPassword = await request(app).post("/api/auth/register").send({
      username: "shorty",
      email: "shorty@example.com",
      password: "short",
    });
    expect(shortPassword.status).toBe(400);

    const invalidEmail = await request(app).post("/api/auth/register").send({
      username: "invalid",
      email: "not-an-email",
      password: "password123",
    });
    expect(invalidEmail.status).toBe(400);
  });

  it("logs in, returns an access token, and never exposes password hashes", async () => {
    const { user } = await seedStandardAuthUsers();
    const { app } = createApp({ seed: [] });

    const response = await completeLogin(app, {
      username: user.username,
      password: user.password,
    });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user.username).toBe(user.username);
    expect(response.body).not.toHaveProperty("passwordHash");
  });

  it("rejects invalid login credentials", async () => {
    const { user } = await seedStandardAuthUsers();
    const { app } = createApp({ seed: [] });

    const wrongPassword = await request(app).post("/api/auth/login").send({
      username: user.username,
      password: "wrong-password",
    });
    expect(wrongPassword.status).toBe(401);

    const missingUser = await request(app).post("/api/auth/login").send({
      username: "missing-user",
      password: "password123",
    });
    expect(missingUser.status).toBe(401);
  });

  it("sends password reset email for known users and stays silent for unknown users", async () => {
    const { user } = await seedStandardAuthUsers();
    const { app } = createApp({ seed: [] });

    const knownUserResponse = await request(app).post("/api/auth/forgot-password").send({
      email: user.email,
    });

    expect(knownUserResponse.status).toBe(200);
    expect(knownUserResponse.body.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalled();
    expect(getLastResetEmailText()).toContain("/reset-password?token=");
    expect(getLastResetEmailText()).toContain(`email=${encodeURIComponent(user.email)}`);

    mockSendMail.mockClear();

    const unknownUserResponse = await request(app).post("/api/auth/forgot-password").send({
      email: "missing@example.com",
    });

    expect(unknownUserResponse.status).toBe(200);
    expect(unknownUserResponse.body.success).toBe(true);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("resets the password with a valid token and allows logging in with the new password", async () => {
    const { user } = await seedStandardAuthUsers();
    const { app } = createApp({ seed: [] });

    const forgotResponse = await request(app).post("/api/auth/forgot-password").send({
      email: user.email,
    });

    expect(forgotResponse.status).toBe(200);

    const token = getResetTokenFromEmail();
    expect(token).toEqual(expect.any(String));

    const resetResponse = await request(app).post("/api/auth/reset-password").send({
      email: user.email,
      token,
      newPassword: "newpassword123",
    });

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.success).toBe(true);

    const oldPasswordLogin = await request(app).post("/api/auth/login").send({
      username: user.username,
      password: user.password,
    });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await request(app).post("/api/auth/login").send({
      username: user.username,
      password: "newpassword123",
    });
    expect(newPasswordLogin.status).toBe(200);
  });

  it("rejects expired, invalid, and short password reset attempts", async () => {
    const { user } = await seedStandardAuthUsers();
    const { app } = createApp({ seed: [] });

    await request(app).post("/api/auth/forgot-password").send({
      email: user.email,
    });

    const token = getResetTokenFromEmail();

    await prisma.user.update({
      where: { email: user.email },
      data: { resetTokenExpiresAt: new Date(Date.now() - 60_000) },
    });

    const expiredResponse = await request(app).post("/api/auth/reset-password").send({
      email: user.email,
      token,
      newPassword: "newpassword123",
    });
    expect(expiredResponse.status).toBe(400);

    const invalidResponse = await request(app).post("/api/auth/reset-password").send({
      email: user.email,
      token: "not-a-valid-token",
      newPassword: "newpassword123",
    });
    expect(invalidResponse.status).toBe(400);

    const shortPasswordResponse = await request(app).post("/api/auth/reset-password").send({
      email: user.email,
      token,
      newPassword: "short",
    });
    expect(shortPasswordResponse.status).toBe(400);
  });

  it("returns the current user for valid bearer tokens and rejects missing or expired tokens", async () => {
    const { user } = await seedStandardAuthUsers();
    const { app } = createApp({ seed: [] });
    const loginResponse = await completeLogin(app, {
      username: user.username,
      password: user.password,
    });

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken as string}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.username).toBe(user.username);

    const missingToken = await request(app).get("/api/auth/me");
    expect(missingToken.status).toBe(401);

    const expiredToken = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${createExpiredToken()}`);
    expect(expiredToken.status).toBe(401);
  });

  it("refreshes access tokens from the refresh cookie and clears it on logout", async () => {
    const { user } = await seedStandardAuthUsers();
    const { app } = createApp({ seed: [] });

    const loginResponse = await completeLogin(app, {
      username: user.username,
      password: user.password,
    });

    const refreshCookie = getRefreshCookie(loginResponse);

    const refreshResponse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refreshCookie);

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));

    const logoutResponse = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", refreshCookie);

    expect(logoutResponse.status).toBe(200);
    expect(getRefreshCookie(logoutResponse)).toBe("refreshToken=");

    const refreshAfterLogout = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", getRefreshCookie(logoutResponse));

    expect(refreshAfterLogout.status).toBe(401);
  });

  it("enforces artwork authorization for create and delete operations", async () => {
    const { user } = await seedStandardAuthUsers();
    const { app } = createApp({ seed: [] });

    const unauthenticatedCreate = await request(app).post("/api/artworks").send({
      title: "Unauthorized",
      artist: "Nobody",
      year: 2024,
      price: 100,
      category: "Abstract",
      description: "This should not be created without a bearer token.",
      imageUrl: "https://example.com/unauth.jpg",
    });
    expect(unauthenticatedCreate.status).toBe(401);

    const adminHeaders = {
      Authorization: `Bearer ${generateAccessToken({
        id: "admin-id",
        username: "admin",
        email: "admin@example.com",
        role: "admin",
        permissions: ["artwork:create", "artwork:edit", "artwork:delete"],
      })}`,
    };

    const created = await request(app)
      .post("/api/artworks")
      .set(adminHeaders)
      .send({
        title: "Protected Artwork",
        artist: "Admin",
        year: 2024,
        price: 250,
        category: "Abstract",
        description: "A valid artwork used to verify authorization on delete routes.",
        imageUrl: "https://example.com/protected.jpg",
      });

    expect(created.status).toBe(201);

    const userHeaders = {
      Authorization: `Bearer ${generateAccessToken({
        id: "user-id",
        username: user.username,
        email: user.email,
        role: "user",
        permissions: [],
      })}`,
    };

    const forbiddenDelete = await request(app)
      .delete(`/api/artworks/${created.body.id}`)
      .set(userHeaders);
    expect(forbiddenDelete.status).toBe(403);

    const adminDelete = await request(app)
      .delete(`/api/artworks/${created.body.id}`)
      .set(adminHeaders);
    expect(adminDelete.status).toBe(200);
    expect(adminDelete.body.success).toBe(true);
  });
});
