import crypto from "crypto";
import { createBase32Plugin, createCryptoPlugin } from "@otplib/core";
import { TOTP } from "@otplib/totp";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE32_LOOKUP = new Map(BASE32_ALPHABET.split("").map((character, index) => [character, index] as const));

function encodeBase32(bytes: Uint8Array) {
  let value = 0;
  let bits = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/=+$/g, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let accumulated = 0;
  const output: number[] = [];

  for (const character of normalized) {
    const chunk = BASE32_LOOKUP.get(character);

    if (chunk === undefined) {
      continue;
    }

    accumulated = (accumulated << 5) | chunk;
    bits += 5;

    if (bits >= 8) {
      output.push((accumulated >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Uint8Array.from(output);
}

const cryptoPlugin = createCryptoPlugin({
  hmac: (algorithm: string, key: Uint8Array, message: Uint8Array) => {
    return crypto.createHmac(algorithm, Buffer.from(key)).update(Buffer.from(message)).digest();
  },
  randomBytes: (size: number) => crypto.randomBytes(size),
  constantTimeEqual: (left: Uint8Array, right: Uint8Array) => {
    if (left.length !== right.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
  },
});

const base32Plugin = createBase32Plugin({
  encode: (bytes: Uint8Array) => encodeBase32(bytes),
  decode: (value: string) => decodeBase32(value),
});

const totp = new TOTP({
  crypto: cryptoPlugin,
  base32: base32Plugin,
});

export function generateTotpSecret() {
  return totp.generateSecret();
}

export async function generateTotpToken(secret: string) {
  return totp.generate({ secret });
}

export async function verifyTotpToken(token: string, secret: string) {
  return totp.verify(token, { secret });
}
