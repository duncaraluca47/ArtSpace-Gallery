import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { createApp } from "../../src/backend/app";
import type { ArtworkService } from "../../src/backend/services/artworkService";
import { ArtworkService as ArtworkServiceImpl } from "../../src/backend/services/artworkService";
import { InMemoryArtworkStore } from "../../src/backend/store/inMemoryArtworkStore";
import {
  disconnectTestDatabase,
  migrateTestDatabase,
  truncateTestDatabase,
} from "./dbTestUtils";

function createService(): ArtworkService {
  return createApp({ seed: [] }).service;
}

function createInMemoryService(): ArtworkServiceImpl {
  return new ArtworkServiceImpl(new InMemoryArtworkStore());
}

async function waitFor(
  assertion: () => Promise<void>,
  timeoutMs = 3000,
  intervalMs = 50,
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await assertion();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  await assertion();
}

describe("ArtworkService", () => {
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

  it("clamps requested page to total pages when page is too large", () => {
    const service = createService();

    service.create({
      title: "One",
      artist: "Artist",
      year: 2024,
      price: 100,
      category: "Abstract",
      description: "Description long enough for service pagination test one.",
      imageUrl: "https://example.com/service-page-1.jpg",
    });

    const result = service.list({ page: 100, pageSize: 5 });

    expect(result.pagination.totalPages).toBeGreaterThanOrEqual(1);
    expect(result.pagination.page).toBe(result.pagination.totalPages);
  });

  it("handles artist/category/search filters with non-matching values", () => {
    const service = createService();

    const result = service.list({
      page: 1,
      pageSize: 5,
      artist: "non-existent-artist",
      category: "non-existent-category",
      search: "non-existent-search",
    });

    expect(result.items).toEqual([]);
    expect(result.pagination.totalItems).toBe(0);
    expect(result.pagination.totalPages).toBe(1);
  });

  it("returns a snapshot copy, not a mutable store reference", () => {
    const service = createService();

    service.create({
      title: "Snapshot Item",
      artist: "Snapshot Artist",
      year: 2024,
      price: 200,
      category: "Abstract",
      description: "Description long enough for snapshot behavior coverage.",
      imageUrl: "https://example.com/snapshot-item.jpg",
    });

    const snapshot = service.getStoreSnapshot();
    const originalLength = snapshot.length;

    snapshot.pop();

    const secondSnapshot = service.getStoreSnapshot();
    expect(secondSnapshot.length).toBe(originalLength);
  });

  it("supports passthrough create, get, update and remove operations", () => {
    const service = createService();

    const created = service.create({
      title: "Temporary",
      artist: "Service Tester",
      year: 2025,
      price: 500,
      category: "Test",
      description: "This description is intentionally long enough to be valid.",
      imageUrl: "https://example.com/service.jpg",
    });

    expect(service.getById(created.id)?.title).toBe("Temporary");

    const updated = service.update(created.id, { price: 700 });
    expect(updated?.price).toBe(700);

    const removed = service.remove(created.id);
    expect(removed).toBe(true);
    expect(service.getById(created.id)).toBeNull();
  });

  it("sorts category distribution alphabetically when counts are equal", async () => {
    const service = createInMemoryService();

    service.create({
      title: "A1",
      artist: "A",
      year: 2022,
      price: 100,
      category: "Zulu",
      description: "Description that is intentionally long enough to be valid.",
      imageUrl: "https://example.com/a1.jpg",
    });

    service.create({
      title: "A2",
      artist: "B",
      year: 2023,
      price: 200,
      category: "Alpha",
      description: "Description that is intentionally long enough to be valid.",
      imageUrl: "https://example.com/a2.jpg",
    });

    await waitFor(async () => {
      const stats = await service.getStats();
      expect(stats.totalArtworks).toBe(2);
    });

    const stats = await service.getStats();

    expect(stats.categoryDistribution).toEqual([
      { category: "Alpha", count: 1 },
      { category: "Zulu", count: 1 },
    ]);
  });

  it("returns zeroed stats for an empty in-memory store", async () => {
    const service = createInMemoryService();

    const stats = await service.getStats();

    expect(stats).toEqual({
      totalArtworks: 0,
      averagePrice: 0,
      minPrice: 0,
      maxPrice: 0,
      categoryDistribution: [],
    });
  });

  it("computes price and review aggregates for in-memory store items", async () => {
    const service = createInMemoryService();

    service.create({
      title: "Stats One",
      artist: "Memory Artist",
      year: 2022,
      price: 100,
      category: "Abstract",
      description: "Description long enough for in-memory stats coverage.",
      imageUrl: "https://example.com/memory-stats-1.jpg",
    });

    service.create({
      title: "Stats Two",
      artist: "Memory Artist",
      year: 2023,
      price: 300,
      category: "Modern",
      description: "Description long enough for in-memory stats coverage.",
      imageUrl: "https://example.com/memory-stats-2.jpg",
    });

    const first = service.getStoreSnapshot()[0];
    const second = service.getStoreSnapshot()[1];

    service.createReview(first.id, {
      id: "r1",
      userName: "Alice",
      rating: 5,
      comment: "Excellent",
      date: "2026-05-13",
    });

    service.createReview(second.id, {
      id: "r2",
      userName: "Bob",
      rating: 3,
      comment: "Good",
      date: "2026-05-13",
    });

    const stats = await service.getStats();

    expect(stats.totalArtworks).toBe(2);
    expect(stats.averagePrice).toBe(200);
    expect(stats.minPrice).toBe(100);
    expect(stats.maxPrice).toBe(300);
    expect(stats.totalReviews).toBe(2);
    expect(stats.averageRating).toBe(4);
    expect(stats.categoryDistribution).toEqual([
      { category: "Abstract", count: 1 },
      { category: "Modern", count: 1 },
    ]);
  });

  it("returns averageRating zero when in-memory items have no reviews", async () => {
    const service = createInMemoryService();

    service.create({
      title: "No Review Piece",
      artist: "Solo Artist",
      year: 2024,
      price: 250,
      category: "Minimal",
      description: "Description long enough for no-review stats branch testing.",
      imageUrl: "https://example.com/no-review.jpg",
    });

    const stats = await service.getStats();

    expect(stats.totalReviews).toBe(0);
    expect(stats.averageRating).toBe(0);
  });
});
