import type { AuthTokenUser } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenUser;
    }
  }
}

export {};
