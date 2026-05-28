import cors from "cors";
import express from "express";
import { seedArtworks } from "./data/seedArtworks";
import { createGraphQLHandler } from "./graphql/handler";
import { createAuthRouter } from "../routes/authRoutes";
import { createArtworkRouter } from "./routes/artworkRoutes";
import { createFakeDataRouter } from "./routes/fakeDataRoutes";
import { createStatsRouter } from "./routes/statsRoutes";
import { FakeDataGenerator } from "./services/fakeDataGenerator";
import { ArtworkService } from "./services/artworkService";
import { PrismaArtworkStore } from "../prismaArtworkStore";
import type { ArtworkCreateInput } from "./types";

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, "");
}

function parseCorsOrigins(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const origins = value
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

  return origins.length > 0 ? origins : undefined;
}

export type AppDependencies = {
  seed?: ArtworkCreateInput[];
  fakeDataGenerator?: FakeDataGenerator;
};

export type AppReturn = {
  app: express.Application;
  service: ArtworkService;
  fakeDataGenerator: FakeDataGenerator;
};

export function createApp(deps: AppDependencies = {}): AppReturn {
  const app = express();

  const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);
  const corsOrigin = corsOrigins
    ? (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        callback(null, corsOrigins.includes(normalizeOrigin(origin)));
      }
    : process.env.NODE_ENV === "production"
      ? false
      : true;

  const store = new PrismaArtworkStore(deps.seed ?? seedArtworks);
  const service = new ArtworkService(store);
  const fakeDataGenerator = deps.fakeDataGenerator ?? new FakeDataGenerator();
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get("/", (_req, res) => {
    return res.status(200).json({
      name: "ArtSpace Backend API",
      version: "1.0.0",
      basePath: "/api",
      endpoints: [
        "POST /api/auth/login",
        "POST /api/auth/login/send-otp",
        "POST /api/auth/login/verify-otp",
        "POST /api/auth/login/verify-totp",
        "POST /api/auth/forgot-password",
        "POST /api/auth/reset-password",
        "POST /api/auth/send-verification",
        "POST /api/auth/verify-email",
        "POST /api/auth/totp/setup",
        "POST /api/auth/totp/enable",
        "POST /api/auth/logout",
        "GET /api/auth/me",
        "POST /graphql",
        "GET /api/health",
        "GET /api/artworks?page=1&pageSize=5",
        "GET /api/artworks/:id",
        "POST /api/artworks",
        "GET /api/artworks/:id/reviews",
        "POST /api/artworks/:id/reviews",
        "PUT /api/artworks/:id/reviews/:reviewId",
        "DELETE /api/artworks/:id/reviews/:reviewId",
        "PUT /api/artworks/:id",
        "DELETE /api/artworks/:id",
        "GET /api/stats/overview",
      ],
    });
  });

  app.get("/api", (_req, res) => {
    return res.status(200).json({
      message: "Use /api/health, /api/artworks, and /api/stats/overview.",
    });
  });

  app.get("/api/health", (req, res) => {
    if (req.header("x-force-error") === "1") {
      throw new Error("Forced error for testing.");
    }

    return res.status(200).json({ status: "ok", storage: "postgres" });
  });

  app.all("/graphql", createGraphQLHandler(service, fakeDataGenerator));

  app.use("/api/auth", createAuthRouter());
  app.use("/api/artworks", createArtworkRouter(service));
  app.use("/api/stats", createStatsRouter(service));
  app.use("/api/fake-data", createFakeDataRouter(fakeDataGenerator, service));

  app.use((_req, res) => {
    return res.status(404).json({ message: "Endpoint not found." });
  });

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(err);
      return res.status(500).json({ message: "Internal server error." });
    },
  );

  return { app, service, fakeDataGenerator };
}
