#!/usr/bin/env tsx
import { generateAccessToken, generateRefreshToken } from "../src/utils/jwt";

type RoleSpecs = {
  role: string;
  permissions: string[];
};

const roleMap: Record<string, RoleSpecs> = {
  user: { role: "user", permissions: ["artwork:view"] },
  editor: { role: "editor", permissions: ["artwork:view", "artwork:create", "artwork:edit"] },
  admin: { role: "admin", permissions: ["artwork:view", "artwork:create", "artwork:edit", "artwork:delete"] },
};

function usage() {
  console.log("Usage: npx tsx scripts/generate-tokens.ts --role <user|editor|admin> [--id ID] [--username NAME]");
  process.exit(1);
}

function argv() {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      out[k] = v;
    }
  }

  return out;
}

async function main() {
  const args = argv();
  const roleKey = args.role;

  if (!roleKey || !roleMap[roleKey]) {
    usage();
  }

  const id = args.id ?? `demo-${roleKey}`;
  const username = args.username ?? `${roleKey}_demo`;

  const spec = roleMap[roleKey];

  const payload = {
    id,
    username,
    email: `${username}@example.com`,
    role: spec.role,
    permissions: spec.permissions,
  } as const;

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  console.log("--- Demo tokens ---");
  console.log("role:", spec.role);
  console.log("permissions:", spec.permissions.join(", "));
  console.log("");
  console.log("accessToken:", accessToken);
  console.log("");
  console.log("refreshToken:", refreshToken);
}

void main();
