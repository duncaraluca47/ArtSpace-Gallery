import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";

export function getAuthenticatedUser(req: Request) {
  const authorization = req.header("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = getAuthenticatedUser(req);

  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.user = user;

  return next();
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const currentUser = req.user ?? getAuthenticatedUser(req);

    if (!currentUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = currentUser;

    if (!currentUser.permissions.includes(permission)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  };
}