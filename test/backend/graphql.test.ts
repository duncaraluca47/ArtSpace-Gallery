import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcrypt";
import { createApp } from "../../src/backend/app";
import { prisma } from "../../src/prismaClient";
import { completeMfaLogin } from "./authTestUtils";
import {
  disconnectTestDatabase,
  migrateTestDatabase,
  truncateTestDatabase,
} from "./dbTestUtils";

vi.mock("../../src/utils/mailer", () => ({
  sendEmail: vi.fn(async () => undefined),
}));

vi.mock("../../src/utils/emailOtp", async () => {
  const actual = await vi.importActual<typeof import("../../src/utils/emailOtp")>("../../src/utils/emailOtp");

  return {
    ...actual,
    generateOtpCode: () => "123456",
  };
});

async function seedGraphQLReviewAuthor(username = "reviewer") {
  await prisma.user.create({
    data: {
      username,
      email: `${username}@example.com`,
      passwordHash: await bcrypt.hash("password123", 10),
      emailVerified: true,
      role: {
        create: {
          name: `graphql-reviewer-${username}`,
        },
      },
    },
  });

  return { username, password: "password123" };
}

async function seedGraphQLAdminUser() {
  await prisma.user.create({
    data: {
      username: "admin",
      email: "admin@example.com",
      passwordHash: await bcrypt.hash("admin12345", 10),
      emailVerified: true,
      role: {
        create: {
          name: "admin",
        },
      },
    },
  });

  return { username: "admin", password: "admin12345" };
}

async function getGraphQLAdminHeaders(app: ReturnType<typeof createApp>["app"]) {
  const adminCredentials = await seedGraphQLAdminUser();
  const adminLoginResponse = await completeMfaLogin(app, adminCredentials);

  return {
    Authorization: `Bearer ${adminLoginResponse.body.accessToken as string}`,
  };
}

describe("GraphQL API", () => {
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

  it("returns health status", async () => {
    const { app } = createApp({ seed: [] });

    const response = await request(app)
      .post("/graphql")
      .send({
        query: `
          query {
            health {
              status
              storage
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.health).toEqual({
      status: "ok",
      storage: "postgres",
    });
  });

  it("creates and fetches an artwork", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getGraphQLAdminHeaders(app);

    const createResponse = await request(app)
      .post("/graphql")
      .set(adminHeaders)
      .send({
        query: `
          mutation CreateArtwork($input: ArtworkCreateInput!) {
            createArtwork(input: $input) {
              id
              title
              artist
              year
              price
              category
              description
              imageUrl
            }
          }
        `,
        variables: {
          input: {
            title: "GraphQL Sunrise",
            artist: "Luna Graph",
            year: 2024,
            price: 2200,
            category: "Modern",
            description: "A vivid sunrise made to validate GraphQL mutation flows.",
            imageUrl: "https://example.com/graphql-sunrise.jpg",
          },
        },
      });

    expect(createResponse.status).toBe(200);
    const created = createResponse.body.data.createArtwork;
    expect(created.id).toEqual(expect.any(String));
    expect(created.title).toBe("GraphQL Sunrise");

    const getResponse = await request(app)
      .post("/graphql")
      .send({
        query: `
          query ArtworkById($id: ID!) {
            artwork(id: $id) {
              id
              title
            }
          }
        `,
        variables: { id: created.id },
      });

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data.artwork).toEqual({
      id: created.id,
      title: "GraphQL Sunrise",
    });
  });

  it("rejects unauthenticated admin GraphQL mutations", async () => {
    const { app } = createApp({ seed: [] });

    const response = await request(app)
      .post("/graphql")
      .send({
        query: `
          mutation CreateArtwork($input: ArtworkCreateInput!) {
            createArtwork(input: $input) {
              id
            }
          }
        `,
        variables: {
          input: {
            title: "Blocked Piece",
            artist: "Anonymous",
            year: 2024,
            price: 1000,
            category: "Modern",
            description: "This mutation should fail without an authenticated admin user.",
            imageUrl: "https://example.com/blocked.jpg",
          },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.errors?.[0]?.message).toBe("Authentication required.");
  });

  it("supports pagination and filters", async () => {
    const { app } = createApp();

    const response = await request(app)
      .post("/graphql")
      .send({
        query: `
          query ArtworksPage($page: Int!, $pageSize: Int!, $category: String) {
            artworks(page: $page, pageSize: $pageSize, category: $category) {
              items {
                id
                category
              }
              pagination {
                page
                pageSize
                totalItems
                totalPages
              }
            }
          }
        `,
        variables: {
          page: 1,
          pageSize: 2,
          category: "Abstract",
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.data.artworks.items.length).toBeLessThanOrEqual(2);
    expect(response.body.data.artworks.pagination.page).toBe(1);
    expect(response.body.data.artworks.pagination.pageSize).toBe(2);
  });

  it("updates and deletes artwork", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getGraphQLAdminHeaders(app);

    const createResponse = await request(app)
      .post("/graphql")
      .set(adminHeaders)
      .send({
        query: `
          mutation CreateArtwork($input: ArtworkCreateInput!) {
            createArtwork(input: $input) {
              id
            }
          }
        `,
        variables: {
          input: {
            title: "Mutable Piece",
            artist: "Edit Artist",
            year: 2023,
            price: 1500,
            category: "Abstract",
            description: "A mutable artwork used to verify update and delete mutations.",
            imageUrl: "https://example.com/mutable.jpg",
          },
        },
      });

    const id = createResponse.body.data.createArtwork.id;

    const updateResponse = await request(app)
      .post("/graphql")
      .set(adminHeaders)
      .send({
        query: `
          mutation UpdateArtwork($id: ID!, $input: ArtworkUpdateInput!) {
            updateArtwork(id: $id, input: $input) {
              id
              price
            }
          }
        `,
        variables: {
          id,
          input: {
            price: 3333,
          },
        },
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.updateArtwork.price).toBe(3333);

    const deleteResponse = await request(app)
      .post("/graphql")
      .set(adminHeaders)
      .send({
        query: `
          mutation DeleteArtwork($id: ID!) {
            deleteArtwork(id: $id)
          }
        `,
        variables: { id },
      });

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.data.deleteArtwork).toBe(true);
  });

  it("supports review queries and mutations", async () => {
    const credentials = await seedGraphQLReviewAuthor();
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getGraphQLAdminHeaders(app);
    const loginResponse = await completeMfaLogin(app, credentials);
    const authHeaders = {
      Authorization: `Bearer ${loginResponse.body.accessToken as string}`,
    };

    const createArtworkResponse = await request(app)
      .post("/graphql")
      .set(adminHeaders)
      .send({
        query: `
          mutation CreateArtwork($input: ArtworkCreateInput!) {
            createArtwork(input: $input) {
              id
            }
          }
        `,
        variables: {
          input: {
            title: "Review GraphQL Piece",
            artist: "GraphQL Tester",
            year: 2026,
            price: 1800,
            category: "Contemporary",
            description: "A valid artwork used to verify GraphQL review operations.",
            imageUrl: "https://example.com/review-graphql.jpg",
          },
        },
      });

    const artworkId = createArtworkResponse.body.data.createArtwork.id;

    const createReviewResponse = await request(app)
      .post("/graphql")
      .set(authHeaders)
      .send({
        query: `
          mutation CreateReview($artworkId: ID!, $input: ReviewCreateInput!) {
            createReview(artworkId: $artworkId, input: $input) {
              id
              userName
              rating
              comment
              date
            }
          }
        `,
        variables: {
          artworkId,
          input: {
            userName: "Someone Else",
            rating: 5,
            comment: "Excellent via GraphQL.",
          },
        },
      });

    expect(createReviewResponse.status).toBe(200);
    const reviewId = createReviewResponse.body.data.createReview.id;
    expect(createReviewResponse.body.data.createReview.userName).toBe(credentials.username);

    const reviewsResponse = await request(app)
      .post("/graphql")
      .send({
        query: `
          query Reviews($artworkId: ID!) {
            reviews(artworkId: $artworkId) {
              id
              rating
              comment
            }
          }
        `,
        variables: { artworkId },
      });

    expect(reviewsResponse.status).toBe(200);
    expect(reviewsResponse.body.data.reviews).toHaveLength(1);

    const updateReviewResponse = await request(app)
      .post("/graphql")
      .set(authHeaders)
      .send({
        query: `
          mutation UpdateReview($artworkId: ID!, $reviewId: ID!, $input: ReviewUpdateInput!) {
            updateReview(artworkId: $artworkId, reviewId: $reviewId, input: $input) {
              id
              rating
              comment
            }
          }
        `,
        variables: {
          artworkId,
          reviewId,
          input: {
            rating: 4,
            comment: "Still strong, just slightly less perfect.",
          },
        },
      });

    expect(updateReviewResponse.status).toBe(200);
    expect(updateReviewResponse.body.data.updateReview.rating).toBe(4);

    const deleteReviewResponse = await request(app)
      .post("/graphql")
      .set(authHeaders)
      .send({
        query: `
          mutation DeleteReview($artworkId: ID!, $reviewId: ID!) {
            deleteReview(artworkId: $artworkId, reviewId: $reviewId)
          }
        `,
        variables: { artworkId, reviewId },
      });

    expect(deleteReviewResponse.status).toBe(200);
    expect(deleteReviewResponse.body.data.deleteReview).toBe(true);

    const secondCreateReviewResponse = await request(app)
      .post("/graphql")
      .set(authHeaders)
      .send({
        query: `
          mutation CreateReview($artworkId: ID!, $input: ReviewCreateInput!) {
            createReview(artworkId: $artworkId, input: $input) {
              id
              userName
            }
          }
        `,
        variables: {
          artworkId,
          input: {
            userName: "Ignored Author",
            rating: 4,
            comment: "Admin should be able to delete this.",
          },
        },
      });

    expect(secondCreateReviewResponse.status).toBe(200);

    const adminDeleteReviewResponse = await request(app)
      .post("/graphql")
      .set(adminHeaders)
      .send({
        query: `
          mutation DeleteReview($artworkId: ID!, $reviewId: ID!) {
            deleteReview(artworkId: $artworkId, reviewId: $reviewId)
          }
        `,
        variables: { artworkId, reviewId: secondCreateReviewResponse.body.data.createReview.id },
      });

    expect(adminDeleteReviewResponse.status).toBe(200);
    expect(adminDeleteReviewResponse.body.data.deleteReview).toBe(true);
  });

  it("returns stats", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getGraphQLAdminHeaders(app);

    await prisma.artwork.createMany({
      data: [
        {
          id: "graphql-stats-a",
          title: "GraphQL Stats A",
          artist: "Stats Artist",
          year: 2024,
          medium: "Abstract",
          description: "First seeded record for GraphQL stats query verification.",
          imageUrl: "https://example.com/graphql-stats-a.jpg",
          price: 200,
          forSale: true,
          likes: 0,
        },
        {
          id: "graphql-stats-b",
          title: "GraphQL Stats B",
          artist: "Stats Artist",
          year: 2024,
          medium: "Modern",
          description: "Second seeded record for GraphQL stats query verification.",
          imageUrl: "https://example.com/graphql-stats-b.jpg",
          price: 400,
          forSale: true,
          likes: 0,
        },
      ],
    });

    const response = await request(app)
      .post("/graphql")
      .set(adminHeaders)
      .send({
        query: `
          query {
            stats {
              totalArtworks
              averagePrice
              minPrice
              maxPrice
              categoryDistribution {
                category
                count
              }
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.stats.totalArtworks).toBe(2);
    expect(response.body.data.stats.averagePrice).toBe(300);
    expect(Array.isArray(response.body.data.stats.categoryDistribution)).toBe(true);
  });

  it("validates bad input", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getGraphQLAdminHeaders(app);

    const response = await request(app)
      .post("/graphql")
      .set(adminHeaders)
      .send({
        query: `
          mutation CreateArtwork($input: ArtworkCreateInput!) {
            createArtwork(input: $input) {
              id
            }
          }
        `,
        variables: {
          input: {
            title: "",
            artist: "",
            year: 10,
            price: -1,
            category: "",
            description: "short",
            imageUrl: "invalid",
          },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  it("starts and stops fake data generation", async () => {
    const { app } = createApp({ seed: [] });
    const adminHeaders = await getGraphQLAdminHeaders(app);

    const startResponse = await request(app)
      .post("/graphql")
      .set(adminHeaders)
      .send({
        query: `
          mutation StartFakeData($batchSize: Int!, $intervalMs: Int!) {
            startFakeData(batchSize: $batchSize, intervalMs: $intervalMs) {
              isActive
              status
              batchSize
              intervalMs
            }
          }
        `,
        variables: {
          batchSize: 2,
          intervalMs: 1000,
        },
      });

    expect(startResponse.status).toBe(200);
    expect(startResponse.body.data.startFakeData.isActive).toBe(true);

    const statusResponse = await request(app)
      .post("/graphql")
      .set(adminHeaders)
      .send({
        query: `
          query {
            fakeDataStatus {
              isActive
              status
            }
          }
        `,
      });

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.data.fakeDataStatus.isActive).toBe(true);

    const stopResponse = await request(app)
      .post("/graphql")
      .set(adminHeaders)
      .send({
        query: `
          mutation {
            stopFakeData {
              isActive
              status
            }
          }
        `,
      });

    expect(stopResponse.status).toBe(200);
    expect(stopResponse.body.data.stopFakeData.isActive).toBe(false);
  });
});
