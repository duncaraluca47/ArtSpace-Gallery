import type { RequestHandler } from "express";
import { buildSchema, graphql } from "graphql";
import { z } from "zod";
import { ArtworkService } from "../services/artworkService";
import { FakeDataGenerator } from "../services/fakeDataGenerator";
import {
  artworkCreateSchema,
  artworkUpdateSchema,
  idParamSchema,
  reviewCreateSchema,
  reviewIdParamSchema,
  reviewUpdateSchema,
  listQuerySchema,
} from "../validation/artworkSchemas";
import type { AuthTokenUser } from "../../utils/jwt";
import { getAuthenticatedUser } from "../../middleware/requireAuth";

const startFakeDataSchema = z.object({
  batchSize: z.number().int().min(1).max(100).default(3),
  intervalMs: z.number().int().min(500).max(60_000).default(5000),
});

const graphqlSchema = buildSchema(`
  type Artwork {
    id: ID!
    title: String!
    artist: String!
    year: Int!
    price: Int!
    category: String!
    description: String!
    imageUrl: String!
    likes: Int!
    reviews: [Review!]!
  }

  type Review {
    id: ID!
    userName: String!
    rating: Int!
    comment: String!
    date: String!
  }

  input ReviewCreateInput {
    userName: String!
    rating: Int!
    comment: String!
  }

  input ReviewUpdateInput {
    userName: String
    rating: Int
    comment: String
  }

  type Pagination {
    page: Int!
    pageSize: Int!
    totalItems: Int!
    totalPages: Int!
  }

  type ArtworkListResponse {
    items: [Artwork!]!
    pagination: Pagination!
  }

  type CategoryDistribution {
    category: String!
    count: Int!
  }

  type ArtworksStats {
    totalArtworks: Int!
    averagePrice: Float!
    minPrice: Int!
    maxPrice: Int!
    categoryDistribution: [CategoryDistribution!]!
  }

  type HealthStatus {
    status: String!
    storage: String!
  }

  type FakeDataStatus {
    isActive: Boolean!
    status: String!
    batchSize: Int
    intervalMs: Int
    message: String
  }

  input ArtworkCreateInput {
    id: String
    title: String!
    artist: String!
    year: Int!
    price: Int!
    category: String!
    description: String!
    imageUrl: String!
  }

  input ArtworkUpdateInput {
    id: String
    title: String
    artist: String
    year: Int
    price: Int
    category: String
    description: String
    imageUrl: String
  }

  type Query {
    health: HealthStatus!
    artworks(page: Int = 1, pageSize: Int = 5, artist: String, category: String, search: String): ArtworkListResponse!
    artwork(id: ID!): Artwork
    reviews(artworkId: ID!): [Review!]!
    stats: ArtworksStats!
    fakeDataStatus: FakeDataStatus!
  }

  type Mutation {
    createArtwork(input: ArtworkCreateInput!): Artwork!
    updateArtwork(id: ID!, input: ArtworkUpdateInput!): Artwork!
    deleteArtwork(id: ID!): Boolean!
    createReview(artworkId: ID!, input: ReviewCreateInput!): Review!
    updateReview(artworkId: ID!, reviewId: ID!, input: ReviewUpdateInput!): Review!
    deleteReview(artworkId: ID!, reviewId: ID!): Boolean!
    startFakeData(batchSize: Int = 3, intervalMs: Int = 5000): FakeDataStatus!
    stopFakeData: FakeDataStatus!
  }
`);

export function createGraphQLHandler(
  service: ArtworkService,
  fakeDataGenerator: FakeDataGenerator,
) {
  function requireCurrentUser(currentUser: AuthTokenUser | undefined) {
    if (!currentUser) {
      throw new Error("Authentication required.");
    }

    return currentUser;
  }

  function requireAdminUser(currentUser: AuthTokenUser | undefined) {
    const authenticatedUser = requireCurrentUser(currentUser);

    if (authenticatedUser.role !== "admin") {
      throw new Error("Forbidden.");
    }

    return authenticatedUser;
  }

  const createRoot = (currentUser: AuthTokenUser | undefined) => ({
    health: () => ({ status: "ok", storage: "postgres" }),

    artworks: (args: {
      page?: number;
      pageSize?: number;
      artist?: string;
      category?: string;
      search?: string;
    }) => {
      const parsed = listQuerySchema.parse(args);
      return service.list(parsed);
    },

    artwork: ({ id }: { id: string }) => {
      const parsed = idParamSchema.parse({ id });
      return service.getById(parsed.id) ?? null;
    },

    reviews: ({ artworkId }: { artworkId: string }) => {
      const parsed = idParamSchema.parse({ id: artworkId });
      const reviews = service.listReviews(parsed.id);

      if (reviews === null) {
        throw new Error("Artwork not found.");
      }

      return reviews;
    },

    stats: () => {
      requireAdminUser(currentUser);
      return service.getStats();
    },

    fakeDataStatus: () => {
      requireAdminUser(currentUser);

      return {
      isActive: fakeDataGenerator.isActive(),
      status: fakeDataGenerator.isActive() ? "generating" : "idle",
      message: fakeDataGenerator.isActive()
        ? "Fake data generation is running"
        : "Fake data generation is stopped",
      };
    },

    createArtwork: ({ input }: { input: unknown }) => {
      requireAdminUser(currentUser);
      const parsed = artworkCreateSchema.parse(input);
      return service.create(parsed);
    },

    updateArtwork: ({ id, input }: { id: string; input: unknown }) => {
      requireAdminUser(currentUser);
      const parsedId = idParamSchema.parse({ id });
      const parsedInput = artworkUpdateSchema.parse(input);
      const updated = service.update(parsedId.id, parsedInput);
      if (!updated) {
        throw new Error("Artwork not found.");
      }
      return updated;
    },

    deleteArtwork: ({ id }: { id: string }) => {
      requireAdminUser(currentUser);
      const parsedId = idParamSchema.parse({ id });
      const deleted = service.remove(parsedId.id);
      if (!deleted) {
        throw new Error("Artwork not found.");
      }
      return true;
    },

    createReview: ({ artworkId, input }: { artworkId: string; input: unknown }) => {
      const authenticatedUser = requireCurrentUser(currentUser);
      const parsedId = idParamSchema.parse({ id: artworkId });
      const parsedInput = reviewCreateSchema.parse(input);
      const review = {
        id: `${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
        userName: authenticatedUser.username,
        rating: parsedInput.rating,
        comment: parsedInput.comment,
        date: new Date().toISOString().slice(0, 10),
      };

      const created = service.createReview(parsedId.id, review);
      if (!created) {
        throw new Error("Artwork not found.");
      }

      return created;
    },

    updateReview: ({
      artworkId,
      reviewId,
      input,
    }: {
      artworkId: string;
      reviewId: string;
      input: unknown;
    }) => {
      const parsedArtworkId = idParamSchema.parse({ id: artworkId });
      const parsedReviewId = reviewIdParamSchema.parse({ reviewId });
      const parsedInput = reviewUpdateSchema.parse(input);
      const authenticatedUser = requireCurrentUser(currentUser);

      const artwork = service.getById(parsedArtworkId.id);
      const review = artwork?.reviews.find((item) => item.id === parsedReviewId.reviewId);

      if (!artwork || !review) {
        throw new Error("Artwork or review not found.");
      }

      if (review.userName !== authenticatedUser.username) {
        throw new Error("You can only edit your own review.");
      }

      const updated = service.updateReview(parsedArtworkId.id, parsedReviewId.reviewId, {
        ...parsedInput,
        userName: authenticatedUser.username,
      });
      if (!updated) {
        throw new Error("Artwork or review not found.");
      }

      return updated;
    },

    deleteReview: ({ artworkId, reviewId }: { artworkId: string; reviewId: string }) => {
      const parsedArtworkId = idParamSchema.parse({ id: artworkId });
      const parsedReviewId = reviewIdParamSchema.parse({ reviewId });
      const authenticatedUser = requireCurrentUser(currentUser);

      const artwork = service.getById(parsedArtworkId.id);
      const review = artwork?.reviews.find((item) => item.id === parsedReviewId.reviewId);

      if (!artwork || !review) {
        throw new Error("Artwork or review not found.");
      }

      const canDeleteReview = authenticatedUser.role === "admin" || review.userName === authenticatedUser.username;

      if (!canDeleteReview) {
        throw new Error("You can only delete your own review.");
      }

      const deleted = service.deleteReview(parsedArtworkId.id, parsedReviewId.reviewId);

      if (!deleted) {
        throw new Error("Artwork or review not found.");
      }

      return true;
    },

    startFakeData: ({ batchSize, intervalMs }: { batchSize?: number; intervalMs?: number }) => {
      requireAdminUser(currentUser);
      if (fakeDataGenerator.isActive()) {
        throw new Error("Fake data generation is already running.");
      }

      const parsed = startFakeDataSchema.parse({
        batchSize: batchSize ?? 3,
        intervalMs: intervalMs ?? 5000,
      });

      fakeDataGenerator.startGeneration(
        parsed.batchSize,
        parsed.intervalMs,
        (artworks) => {
          artworks.forEach((artwork) => {
            service.create(artwork);
          });
        },
      );

      return {
        isActive: true,
        status: "generating",
        batchSize: parsed.batchSize,
        intervalMs: parsed.intervalMs,
        message: "Fake data generation started",
      };
    },

    stopFakeData: () => {
      requireAdminUser(currentUser);
      if (!fakeDataGenerator.isActive()) {
        throw new Error("Fake data generation is not running.");
      }

      fakeDataGenerator.stopGeneration();
      return {
        isActive: false,
        status: "stopped",
        message: "Fake data generation stopped",
      };
    },
  });

  const handler: RequestHandler = async (req, res) => {
    const requestBody = req.body as {
      query?: string;
      variables?: Record<string, unknown>;
      operationName?: string;
    };

    if (!requestBody?.query || typeof requestBody.query !== "string") {
      return res.status(400).json({
        errors: [{ message: "GraphQL query must be provided in request body." }],
      });
    }

    const result = await graphql({
      schema: graphqlSchema,
      source: requestBody.query,
      rootValue: createRoot(getAuthenticatedUser(req) ?? req.user),
      variableValues: requestBody.variables,
      operationName: requestBody.operationName,
    });

    return res.status(200).json(result);
  };

  return handler;
}
