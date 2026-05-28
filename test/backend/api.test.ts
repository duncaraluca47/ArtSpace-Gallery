import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/backend/app";
import {
  disconnectTestDatabase,
  migrateTestDatabase,
  truncateTestDatabase,
} from "./dbTestUtils";
import { prisma } from "../../src/prismaClient";
import { generateAccessToken } from "../../src/utils/jwt";

async function getAdminHeaders(app: any) {
  return {
    Authorization: `Bearer ${generateAccessToken({
      id: "admin-id",
      username: "admin",
      email: "admin@example.com",
      role: "admin",
      permissions: ["artwork:create", "artwork:edit", "artwork:delete"],
    })}`,
  };
}

describe("Backend REST API", () => {
  beforeAll(() => {
    migrateTestDatabase();
  });

  beforeEach(async () => {
    await truncateTestDatabase();
  });

  afterEach(async () => {
    await truncateTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("returns API discovery info on root and /api", async () => {
    const { app } = createApp({ seed: [] });

    const root = await request(app).get("/");
    expect(root.status).toBe(200);
    expect(root.body.name).toBe("ArtSpace Backend API");
    expect(root.body.basePath).toBe("/api");

    const api = await request(app).get("/api");
    expect(api.status).toBe(200);
    expect(api.body.message).toContain("/api/health");
  });

  it("returns health status and confirms postgres storage", async () => {
    const { app } = createApp({ seed: [] });

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", storage: "postgres" });
  });

  it("returns 500 when an unexpected error is thrown", async () => {
    const { app } = createApp({ seed: [] });

    const response = await request(app)
      .get("/api/health")
      .set("x-force-error", "1");

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Internal server error.");
  });

  it("creates an artwork and then fetches it by id", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getAdminHeaders(app);

    const payload = {
      title: "Echo of Color",
      artist: "Lina Adams",
      year: 2024,
      price: 1200,
      category: "Abstract",
      description:
        "A colorful abstract composition that explores rhythm and dynamic balance.",
      imageUrl: "https://example.com/echo.jpg",
    };

    const createResponse = await request(app).post("/api/artworks").set(adminHeaders).send(payload);
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject(payload);
    expect(createResponse.body.id).toEqual(expect.any(String));

    const createdId = createResponse.body.id;

    const getResponse = await request(app).get(`/api/artworks/${createdId}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.title).toBe("Echo of Color");
  });

  it("preserves client-generated ids when creating artworks", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getAdminHeaders(app);

    const payload = {
      id: "client-offline-id",
      title: "Offline Replay",
      artist: "Client Sync",
      year: 2024,
      price: 1500,
      category: "Abstract",
      description:
        "A valid payload that represents artwork created while the client was offline.",
      imageUrl: "https://example.com/offline.jpg",
    };

    const createResponse = await request(app).post("/api/artworks").set(adminHeaders).send(payload);
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.id).toBe("client-offline-id");

    const getResponse = await request(app).get("/api/artworks/client-offline-id");
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.title).toBe("Offline Replay");
  });

  it("rejects invalid artwork payloads with detailed validation errors", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getAdminHeaders(app);

    const response = await request(app).post("/api/artworks").set(adminHeaders).send({
      title: "",
      artist: "",
      year: "NaN",
      price: -5,
      category: "",
      description: "too short",
      imageUrl: "not-a-url",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation failed.");
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  it("supports server-side pagination and filter query parameters", async () => {
    const { app } = createApp();

    const response = await request(app)
      .get("/api/artworks")
      .query({ page: 1, pageSize: 2, category: "abstract" });

    expect(response.status).toBe(200);
    expect(response.body.items.length).toBeLessThanOrEqual(2);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
    });
  });

  it("returns 400 when pagination query values are invalid", async () => {
    const { app } = createApp();

    const response = await request(app)
      .get("/api/artworks")
      .query({ page: 0, pageSize: 5000 });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid pagination");
  });

  it("returns 400 for malformed id and empty update payload", async () => {
    const { app } = createApp();
    const adminHeaders = await getAdminHeaders(app);

    const invalidGet = await request(app).get("/api/artworks/%20");
    expect(invalidGet.status).toBe(400);

    const invalidDelete = await request(app).delete("/api/artworks/%20").set(adminHeaders);
    expect(invalidDelete.status).toBe(400);

    const invalidPut = await request(app)
      .put("/api/artworks/%20")
      .set(adminHeaders)
      .send({ title: "Valid title" });
    expect(invalidPut.status).toBe(400);

    const emptyUpdate = await request(app).put("/api/artworks/1").set(adminHeaders).send({});
    expect(emptyUpdate.status).toBe(400);
    expect(emptyUpdate.body.message).toBe("Validation failed.");
  });

  it("updates an artwork and persists changes for current process", async () => {
    const { app } = createApp();
    const adminHeaders = await getAdminHeaders(app);

    const created = await request(app).post("/api/artworks").set(adminHeaders).send({
      title: "Patch Target",
      artist: "Updater",
      year: 2024,
      price: 900,
      category: "Abstract",
      description:
        "An artwork inserted for update route verification with database persistence.",
      imageUrl: "https://example.com/update-target.jpg",
    });
    const id = created.body.id;

    const updateResponse = await request(app).put(`/api/artworks/${id}`).set(adminHeaders).send({
      price: 11111,
      description:
        "An updated description with enough length to satisfy validation rules.",
    });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.price).toBe(11111);

    const readBack = await request(app).get(`/api/artworks/${id}`);
    expect(readBack.status).toBe(200);
    expect(readBack.body.price).toBe(11111);
  });

  it("returns 404 when updating or deleting unknown records", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getAdminHeaders(app);

    const update = await request(app)
      .put("/api/artworks/999")
      .set(adminHeaders)
      .send({ title: "New title" });
    expect(update.status).toBe(404);

    const remove = await request(app).delete("/api/artworks/999").set(adminHeaders);
    expect(remove.status).toBe(404);
  });

  it("deletes an artwork and then reports it as missing", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getAdminHeaders(app);

    const created = await request(app).post("/api/artworks").set(adminHeaders).send({
      title: "Delete Target",
      artist: "Remover",
      year: 2024,
      price: 1500,
      category: "Abstract",
      description:
        "An artwork that will be removed to verify delete endpoint semantics.",
      imageUrl: "https://example.com/delete-target.jpg",
    });
    const id = created.body.id;

    const deleteResponse = await request(app).delete(`/api/artworks/${id}`).set(adminHeaders);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);

    const afterDelete = await request(app).get(`/api/artworks/${id}`);
    expect(afterDelete.status).toBe(404);
  });

  it("computes statistics from database-backed data", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getAdminHeaders(app);

    await truncateTestDatabase();

    await prisma.artwork.createMany({
      data: [
        {
          id: "stats-a",
          title: "One",
          artist: "Artist A",
          year: 2020,
          medium: "Abstract",
          description: "Description that is definitely longer than twenty chars.",
          imageUrl: "https://example.com/1.jpg",
          price: 100,
          forSale: true,
          likes: 0,
        },
        {
          id: "stats-b",
          title: "Two",
          artist: "Artist B",
          year: 2021,
          medium: "Modern",
          description: "Description that is definitely longer than twenty chars.",
          imageUrl: "https://example.com/2.jpg",
          price: 300,
          forSale: true,
          likes: 0,
        },
        {
          id: "stats-c",
          title: "Three",
          artist: "Artist C",
          year: 2022,
          medium: "Abstract",
          description: "Description that is definitely longer than twenty chars.",
          imageUrl: "https://example.com/3.jpg",
          price: 500,
          forSale: true,
          likes: 0,
        },
      ],
    });

    const response = await request(app).get("/api/stats/overview").set(adminHeaders);

    expect(response.status).toBe(200);
    expect(response.body.totalArtworks).toBe(3);
    expect(response.body.averagePrice).toBe(300);
    expect(response.body.minPrice).toBe(100);
    expect(response.body.maxPrice).toBe(500);
    expect(response.body.categoryDistribution[0]).toEqual({
      category: "Abstract",
      count: 2,
    });
  });

  it("returns zeroed statistics for an empty database", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getAdminHeaders(app);

    const response = await request(app).get("/api/stats/overview").set(adminHeaders);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      totalArtworks: 0,
      averagePrice: 0,
      minPrice: 0,
      maxPrice: 0,
      categoryDistribution: [],
      totalReviews: 0,
      averageRating: 0,
    });
  });

  it("does not persist data between independent app instances", async () => {
    const { app: firstApp } = createApp({ seed: [] });
    const adminHeaders = await getAdminHeaders(firstApp);

    await request(firstApp).post("/api/artworks").set(adminHeaders).send({
      title: "Transient",
      artist: "Memory",
      year: 2024,
      price: 123,
      category: "Test",
      description: "Temporary data that should never be persisted anywhere.",
      imageUrl: "https://example.com/temp.jpg",
    });

    const { app: secondApp } = createApp({ seed: [] });
    const listFromSecond = await request(secondApp).get("/api/artworks");

    expect(listFromSecond.status).toBe(200);
    expect(listFromSecond.body.items).toEqual([]);
    expect(listFromSecond.body.pagination.totalItems).toBe(0);
  });

  it("returns DB-computed stats for known inserted data", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getAdminHeaders(app);

    await prisma.artwork.createMany({
      data: [
        {
          id: "known-a",
          title: "Stats One",
          artist: "Known Artist",
          year: 2024,
          medium: "Abstract",
          description:
            "First artwork inserted for deterministic stats endpoint verification.",
          imageUrl: "https://example.com/stats-one.jpg",
          price: 100,
          forSale: true,
          likes: 0,
        },
        {
          id: "known-b",
          title: "Stats Two",
          artist: "Known Artist",
          year: 2024,
          medium: "Modern",
          description:
            "Second artwork inserted for deterministic stats endpoint verification.",
          imageUrl: "https://example.com/stats-two.jpg",
          price: 300,
          forSale: true,
          likes: 0,
        },
      ],
    });

    await prisma.review.createMany({
      data: [
        {
          id: "review-known-a",
          artworkId: "known-a",
          author: "R1",
          rating: 4,
          comment: "Solid",
        },
        {
          id: "review-known-b",
          artworkId: "known-b",
          author: "R2",
          rating: 2,
          comment: "Okay",
        },
      ],
    });

    const response = await request(app).get("/api/stats/overview").set(adminHeaders);

    expect(response.status).toBe(200);
    expect(response.body.totalArtworks).toBe(2);
    expect(response.body.totalReviews).toBe(2);
    expect(response.body.averagePrice).toBe(200);
    expect(response.body.averageRating).toBe(3);
    expect(response.body.categoryDistribution).toEqual([
      { category: "Abstract", count: 1 },
      { category: "Modern", count: 1 },
    ]);
  });

  it("reports fake-data status and supports start/stop flow", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getAdminHeaders(app);

    const anonymousInitial = await request(app).get("/api/fake-data/status");
    expect(anonymousInitial.status).toBe(401);

    const initial = await request(app).get("/api/fake-data/status").set(adminHeaders);
    expect(initial.status).toBe(200);
    expect(initial.body).toEqual({ isActive: false, status: "idle" });

      const started = await request(app)
        .post("/api/fake-data/start")
        .set(adminHeaders)
        .query({ batchSize: 2, intervalMs: 1000 });
    expect(started.status).toBe(200);
    expect(started.body.status).toBe("generating");
    expect(started.body.batchSize).toBe(2);
    expect(started.body.intervalMs).toBe(1000);

    const active = await request(app).get("/api/fake-data/status").set(adminHeaders);
    expect(active.status).toBe(200);
    expect(active.body).toEqual({ isActive: true, status: "generating" });

    const stopped = await request(app).post("/api/fake-data/stop").set(adminHeaders);
    expect(stopped.status).toBe(200);
    expect(stopped.body.status).toBe("stopped");
  });

  it("returns 400 when fake-data start is requested while already running", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getAdminHeaders(app);

    const firstStart = await request(app)
      .post("/api/fake-data/start")
      .set(adminHeaders)
      .query({ batchSize: 1, intervalMs: 1000 });
    expect(firstStart.status).toBe(200);

    const secondStart = await request(app)
      .post("/api/fake-data/start")
      .set(adminHeaders)
      .query({ batchSize: 1, intervalMs: 1000 });
    expect(secondStart.status).toBe(400);
    expect(secondStart.body.error).toContain("already running");

    const stopped = await request(app).post("/api/fake-data/stop").set(adminHeaders);
    expect(stopped.status).toBe(200);
  });

  it("returns 400 when fake-data stop is requested while not running", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getAdminHeaders(app);

    const response = await request(app).post("/api/fake-data/stop").set(adminHeaders);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("not running");
  });

  it("returns 404 for unknown endpoints", async () => {
    const { app } = createApp();

    const response = await request(app).get("/api/unknown-route");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Endpoint not found.");
  });
});
