import jwt from "jsonwebtoken";

export type AuthTokenUser = {
  id: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
  tokenType: "access" | "refresh";
};

export type MfaStepToken = {
  userId: string;
  step: "mfa" | "totp";
};

const JWT_SECRET = process.env.JWT_SECRET ?? "supersecretkey_change_in_production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "15m";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";
const JWT_MFA_STEP_EXPIRES_IN = process.env.JWT_MFA_STEP_EXPIRES_IN ?? "5m";

function signToken(payload: Omit<AuthTokenUser, "tokenType">, expiresIn: string, tokenType: AuthTokenUser["tokenType"]) {
  return jwt.sign({ ...payload, tokenType }, JWT_SECRET, { expiresIn });
}

export function generateAccessToken(payload: Omit<AuthTokenUser, "tokenType">) {
  return signToken(payload, JWT_EXPIRES_IN, "access");
}

export function generateRefreshToken(payload: Omit<AuthTokenUser, "tokenType">) {
  return signToken(payload, JWT_REFRESH_EXPIRES_IN, "refresh");
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as AuthTokenUser;
}

export function verifyAccessToken(token: string) {
  const decoded = verifyToken(token);

  if (decoded.tokenType !== "access") {
    throw new Error("Invalid access token");
  }

  return decoded;
}

export function verifyRefreshToken(token: string) {
  const decoded = verifyToken(token);

  if (decoded.tokenType !== "refresh") {
    throw new Error("Invalid refresh token");
  }

  return decoded;
}

export function generateMfaStepToken(payload: MfaStepToken) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_MFA_STEP_EXPIRES_IN });
}

export function verifyMfaStepToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as MfaStepToken;
}
