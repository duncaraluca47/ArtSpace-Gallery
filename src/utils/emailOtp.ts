import bcrypt from "bcrypt";

export const OTP_EXPIRES_IN_MS = 10 * 60 * 1000;

export function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function hashOtpCode(code: string) {
  return bcrypt.hash(code, 10);
}

export async function verifyOtpCode(code: string, hashedCode: string) {
  return bcrypt.compare(code, hashedCode);
}
