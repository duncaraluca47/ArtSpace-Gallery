import crypto from "crypto";
import bcrypt from "bcrypt";
import qrcode from "qrcode";
import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import prisma from "../prismaClient";
import {
  generateAccessToken,
  generateMfaStepToken,
  generateRefreshToken,
  verifyMfaStepToken,
  verifyRefreshToken,
  type AuthTokenUser,
} from "../utils/jwt";
import { generateOtpCode, hashOtpCode, verifyOtpCode, OTP_EXPIRES_IN_MS } from "../utils/emailOtp";
import { sendEmail } from "../utils/mailer";
import { generateTotpSecret, verifyTotpToken } from "../utils/totp";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const stepTokenSchema = z.object({
  stepToken: z.string().min(1),
});

const verifyOtpSchema = z.object({
  stepToken: z.string().min(1),
  code: z.string().trim().length(6),
});

const verifyTotpSchema = z.object({
  stepToken: z.string().min(1),
  token: z.string().trim().length(6),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email(),
  token: z.string().trim().min(1),
  newPassword: z.string().min(8),
});

const verificationCodeSchema = z.object({
  code: z.string().trim().length(6),
});

const registrationVerificationSchema = z.object({
  username: z.string().trim().min(1),
  code: z.string().trim().length(6),
});

const resendRegistrationVerificationSchema = z.object({
  username: z.string().trim().min(1),
});

const registerSchema = z.object({
  username: z.string().trim().min(3),
  email: z.string().trim().email(),
  password: z.string().min(8),
});

type LoadedUser = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;
type ResponseUser = Omit<AuthTokenUser, "tokenType">;

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const EMAIL_OTP_PURPOSE = "email-verification";
const LOGIN_OTP_PURPOSE = "login-otp";

function toResponseUser(user: LoadedUser) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role.name,
    permissions: user.role.permissions.map((permission) => permission.name),
  };
}

function toTokenUser(user: LoadedUser): ResponseUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role.name,
    permissions: user.role.permissions.map((permission) => permission.name),
  };
}

function parseCookieHeader(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return new Map<string, string>();
  }

  return new Map(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex === -1) {
          return [part, ""] as const;
        }

        const name = part.slice(0, separatorIndex);
        const value = part.slice(separatorIndex + 1);
        return [name, decodeURIComponent(value)] as const;
      }),
  );
}

function getRefreshCookieOptions() {
  const corsOrigin = process.env.CORS_ORIGIN;
  const sameSite = typeof corsOrigin === "string" && corsOrigin.startsWith("http") ? ("none" as const) : ("lax" as const);

  return {
    httpOnly: true,
    sameSite,
    secure: process.env.NODE_ENV !== "test",
    path: "/api/auth",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  };
}

function getFrontendUrl() {
  return process.env.FRONTEND_URL ?? "http://localhost:5173";
}

function buildPasswordResetUrl(email: string, token: string) {
  const url = new URL("/reset-password", getFrontendUrl());
  url.searchParams.set("token", token);
  url.searchParams.set("email", email);
  return url.toString();
}

async function loadUserWithRole(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });
}

async function loadUserFromStepToken(stepToken: string, expectedStep: "mfa" | "totp") {
  const decoded = verifyMfaStepToken(stepToken);

  if (decoded.step !== expectedStep) {
    return null;
  }

  return loadUserWithRole(decoded.userId);
}

async function storePendingOtp(userId: string, purpose: string) {
  const code = generateOtpCode();
  const hashedOtp = await hashOtpCode(`${purpose}:${code}`);

  await prisma.user.update({
    where: { id: userId },
    data: {
      pendingOtp: hashedOtp,
      pendingOtpExpiresAt: new Date(Date.now() + OTP_EXPIRES_IN_MS),
    },
  });

  return code;
}

async function issueOtpChallenge(user: LoadedUser, purpose: string) {
  const code = await storePendingOtp(user.id, purpose);
  const subject = purpose === EMAIL_OTP_PURPOSE ? "Verify your ArtSpace email" : "Your ArtSpace login code";

  try {
    await sendEmail(
      user.email,
      subject,
      `${subject}\n\nYour one-time code is: ${code}\n\nIt expires in 10 minutes.`,
    );
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }

    console.warn("Unable to send verification email, returning development fallback code:", error);
  }

  return code;
}

async function verifyStoredOtp(user: LoadedUser, purpose: string, code: string) {
  if (!user.pendingOtp || !user.pendingOtpExpiresAt) {
    return false;
  }

  if (user.pendingOtpExpiresAt.getTime() < Date.now()) {
    return false;
  }

  return verifyOtpCode(`${purpose}:${code}`, user.pendingOtp);
}

async function createPasswordResetToken(userId: string) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const resetToken = await bcrypt.hash(rawToken, 10);

  await prisma.user.update({
    where: { id: userId },
    data: {
      resetToken,
      resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return rawToken;
}

async function sendPasswordResetEmail(user: LoadedUser) {
  const rawToken = await createPasswordResetToken(user.id);
  const resetUrl = buildPasswordResetUrl(user.email, rawToken);
  const text = [
    "Reset your ArtSpace password",
    "",
    `Use this link to reset your password: ${resetUrl}`,
    "",
    "If you did not request a reset, you can ignore this email.",
  ].join("\n");
  const html = `
    <p>Reset your ArtSpace password</p>
    <p><a href="${resetUrl}">Click here to reset your password</a></p>
    <p>If you did not request a reset, you can ignore this email.</p>
  `.trim();

  await sendEmail(
    user.email,
    "Reset your ArtSpace password",
    text,
    html,
  );
}

async function verifyPasswordResetToken(user: LoadedUser, rawToken: string) {
  if (!user.resetToken || !user.resetTokenExpiresAt) {
    return false;
  }

  if (user.resetTokenExpiresAt.getTime() < Date.now()) {
    return false;
  }

  return bcrypt.compare(rawToken, user.resetToken);
}

function issueSessionResponse(res: Response, user: LoadedUser) {
  const tokenUser = toTokenUser(user);
  const accessToken = generateAccessToken(tokenUser);
  const refreshToken = generateRefreshToken(tokenUser);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

  return res.status(200).json({
    success: true,
    accessToken,
    user: toResponseUser(user),
  });
}

async function handleLoginStepToken(stepToken: string) {
  try {
    return await loadUserFromStepToken(stepToken, "mfa");
  } catch {
    return null;
  }
}

async function handleTotpStepToken(stepToken: string) {
  try {
    return await loadUserFromStepToken(stepToken, "totp");
  } catch {
    return null;
  }
}

export function createAuthRouter() {
  const router = Router();

  router.post("/register", async (req, res) => {
    const parsedBody = registerSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        error: "Invalid request body.",
        details: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join(".") || "root",
          message: issue.message,
        })),
      });
    }

    const [usernameTaken, emailTaken] = await Promise.all([
      prisma.user.findUnique({ where: { username: parsedBody.data.username } }),
      prisma.user.findUnique({ where: { email: parsedBody.data.email } }),
    ]);

    if (usernameTaken || emailTaken) {
      const fieldErrors: { username?: string; email?: string } = {};

      if (usernameTaken) {
        fieldErrors.username = "Username is already taken.";
      }

      if (emailTaken) {
        fieldErrors.email = "Email is already taken.";
      }

      return res.status(409).json({
        error:
          usernameTaken && emailTaken
            ? "Username and email are already taken."
            : usernameTaken
              ? "Username is already taken."
              : "Email is already taken.",
        fieldErrors,
      });
    }

    let role = await prisma.role.findUnique({
      where: { name: "user" },
      include: {
        permissions: true,
      },
    });

    if (!role) {
      const createdRole = await prisma.role.create({ data: { name: "user" } });
      role = await prisma.role.findUnique({ where: { id: createdRole.id }, include: { permissions: true } });
    }

    if (!role) {
      return res.status(500).json({ error: "Unable to create user role" });
    }

    const created = await prisma.user.create({
      data: {
        username: parsedBody.data.username,
        email: parsedBody.data.email,
        passwordHash: await bcrypt.hash(parsedBody.data.password, 10),
        roleId: role.id,
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    const verificationCode = await issueOtpChallenge(created, EMAIL_OTP_PURPOSE);

    return res.status(201).json({
      success: true,
      verificationRequired: true,
      verificationCode: process.env.NODE_ENV === "production" ? undefined : verificationCode,
      user: {
        id: created.id,
        username: created.username,
        email: created.email,
        role: created.role.name,
      },
    });
  });

  router.post("/send-verification", requireAuth, async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await loadUserWithRole(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await sendOtpEmail(user, EMAIL_OTP_PURPOSE);

    return res.status(200).json({ success: true });
  });

  router.post("/resend-verification", async (req, res) => {
    const parsedBody = resendRegistrationVerificationSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        error: "Invalid request body.",
        details: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join(".") || "root",
          message: issue.message,
        })),
      });
    }

    const user = await prisma.user.findUnique({
      where: { username: parsedBody.data.username },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.emailVerified) {
      return res.status(200).json({ success: true, alreadyVerified: true });
    }

    const verificationCode = await issueOtpChallenge(user, EMAIL_OTP_PURPOSE);

    return res.status(200).json({
      success: true,
      verificationCode: process.env.NODE_ENV === "production" ? undefined : verificationCode,
    });
  });

  router.post("/verify-email", async (req, res) => {
    const parsedBody = registrationVerificationSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        error: "Invalid request body.",
        details: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join(".") || "root",
          message: issue.message,
        })),
      });
    }

    const user = await prisma.user.findUnique({
      where: { username: parsedBody.data.username },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.emailVerified) {
      return res.status(200).json({ success: true, alreadyVerified: true });
    }

    const otpIsValid = await verifyStoredOtp(user, EMAIL_OTP_PURPOSE, parsedBody.data.code);

    if (!otpIsValid) {
      return res.status(401).json({ error: "Invalid or expired verification code" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        pendingOtp: null,
        pendingOtpExpiresAt: null,
      },
    });

    return res.status(200).json({ success: true });
  });

  router.post("/totp/setup", requireAuth, async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await loadUserWithRole(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const secret = generateTotpSecret();
    const otpauth = `otpauth://totp/ArtSpace:${encodeURIComponent(user.username)}?secret=${encodeURIComponent(secret)}&issuer=ArtSpace`;
    const qrCode = await qrcode.toDataURL(otpauth);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpSecret: secret,
        otpEnabled: false,
      },
    });

    return res.status(200).json({ qrCode, secret });
  });

  router.post("/totp/enable", requireAuth, async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsedBody = verifyTotpSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        error: "Invalid request body.",
        details: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join(".") || "root",
          message: issue.message,
        })),
      });
    }

    const user = await loadUserWithRole(req.user.id);

    if (!user || !user.otpSecret) {
      return res.status(400).json({ error: "TOTP is not configured" });
    }

    const tokenIsValid = await verifyTotpToken(parsedBody.data.token, user.otpSecret);

    if (!tokenIsValid) {
      return res.status(401).json({ error: "Invalid TOTP code" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpEnabled: true,
      },
    });

    return res.status(200).json({ success: true });
  });

  router.post("/login", async (req, res) => {
    const parsedBody = loginSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        error: "Invalid request body.",
        details: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join(".") || "root",
          message: issue.message,
        })),
      });
    }

    const user = await prisma.user.findUnique({
      where: { username: parsedBody.data.username },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user || !user.role) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const passwordIsValid = await bcrypt.compare(parsedBody.data.password, user.passwordHash);

    if (!passwordIsValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Temporarily bypass email OTP and TOTP verification so users can
    // sign in with username + password only. Keep the original flow
    // in place for re-enabling later.
    return issueSessionResponse(res, user);
  });

  router.post("/forgot-password", async (req, res) => {
    const parsedBody = forgotPasswordSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        error: "Invalid request body.",
        details: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join(".") || "root",
          message: issue.message,
        })),
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsedBody.data.email },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (user) {
      try {
        await sendPasswordResetEmail(user);
      } catch (error) {
        if (process.env.NODE_ENV === "production") {
          throw error;
        }

        console.warn("Unable to send password reset email:", error);
      }
    }

    return res.status(200).json({ success: true });
  });

  router.post("/reset-password", async (req, res) => {
    const parsedBody = resetPasswordSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        error: "Invalid request body.",
        details: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join(".") || "root",
          message: issue.message,
        })),
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsedBody.data.email },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user || !(await verifyPasswordResetToken(user, parsedBody.data.token))) {
      return res.status(400).json({ error: "This link has expired. Please request a new one." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(parsedBody.data.newPassword, 10),
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    });

    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());

    return res.status(200).json({ success: true });
  });

  router.post("/login/send-otp", async (req, res) => {
    const parsedBody = stepTokenSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        error: "Invalid request body.",
        details: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join(".") || "root",
          message: issue.message,
        })),
      });
    }

    const user = await handleLoginStepToken(parsedBody.data.stepToken);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const verificationCode = await issueOtpChallenge(user, LOGIN_OTP_PURPOSE);

    return res.status(200).json({
      success: true,
      verificationCode: process.env.NODE_ENV === "production" ? undefined : verificationCode,
    });
  });

  router.post("/login/verify-otp", async (req, res) => {
    const parsedBody = verifyOtpSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        error: "Invalid request body.",
        details: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join(".") || "root",
          message: issue.message,
        })),
      });
    }

    const user = await handleLoginStepToken(parsedBody.data.stepToken);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const otpIsValid = await verifyStoredOtp(user, LOGIN_OTP_PURPOSE, parsedBody.data.code);

    if (!otpIsValid) {
      return res.status(401).json({ error: "Invalid or expired verification code" });
    }

    if (user.otpEnabled) {
      const totpStepToken = generateMfaStepToken({ userId: user.id, step: "totp" });

      return res.status(200).json({
        success: true,
        stepToken: totpStepToken,
        requiresTotp: true,
      });
    }

    return issueSessionResponse(res, user);
  });

  router.post("/login/verify-totp", async (req, res) => {
    const parsedBody = verifyTotpSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        error: "Invalid request body.",
        details: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join(".") || "root",
          message: issue.message,
        })),
      });
    }

    const user = await handleTotpStepToken(parsedBody.data.stepToken);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!user.otpSecret || !user.otpEnabled) {
      return res.status(400).json({ error: "TOTP is not enabled" });
    }

    const tokenIsValid = await verifyTotpToken(parsedBody.data.token, user.otpSecret);

    if (!tokenIsValid) {
      return res.status(401).json({ error: "Invalid TOTP code" });
    }

    return issueSessionResponse(res, user);
  });

  router.post("/refresh", async (req, res) => {
    const cookies = parseCookieHeader(req.headers.cookie);
    const refreshToken = cookies.get(REFRESH_COOKIE_NAME);

    if (!refreshToken) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const decoded = verifyRefreshToken(refreshToken);

      const accessToken = generateAccessToken({
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions,
      });

      return res.status(200).json({ accessToken });
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  });

  router.post("/logout", async (_req, res) => {
    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
    return res.status(200).json({ success: true });
  });

  router.get("/me", requireAuth, async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        permissions: req.user.permissions,
      },
    });
  });

  return router;
}
