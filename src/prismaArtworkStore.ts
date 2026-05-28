import { PrismaClient, type Artwork as PrismaArtwork, type Review as PrismaReview } from "./generated/prisma/client.ts";
import { prisma } from "./prismaClient";
import { InMemoryArtworkStore } from "./backend/store/inMemoryArtworkStore";
import type { Artwork, ArtworkCreateInput, ArtworkUpdateInput, ArtworksStats } from "./backend/types";

type ArtworkListFilters = {
  page?: number;
  pageSize?: number;
  medium?: string;
  forSale?: boolean;
  artist?: string;
  priceMin?: number;
  priceMax?: number;
  search?: string;
};

function toReview(review: PrismaReview): Artwork["reviews"][number] {
  return {
    id: review.id,
    userName: review.author,
    rating: review.rating,
    comment: review.comment,
    date: review.createdAt.toISOString().slice(0, 10),
  };
}

function toArtwork(record: PrismaArtwork & { reviews?: PrismaReview[] }): Artwork {
  return {
    id: record.id,
    title: record.title,
    artist: record.artist,
    year: record.year,
    price: record.price,
    category: record.medium,
    description: record.description,
    imageUrl: record.imageUrl,
    likes: record.likes,
    reviews: record.reviews?.map(toReview) ?? [],
  };
}

function toCreateData(input: ArtworkCreateInput, id: string) {
  const seedReviews =
    (input as {
      reviews?: Array<{
        id: string;
        userName: string;
        rating: number;
        comment: string;
        date: string;
      }>;
    }).reviews ?? [];

  return {
    id,
    title: input.title,
    artist: input.artist,
    year: input.year,
    medium: input.category,
    description: input.description,
    imageUrl: input.imageUrl,
    price: input.price,
    forSale: (input as { forSale?: boolean }).forSale ?? true,
    likes: (input as { likes?: number }).likes ?? 0,
    ...(seedReviews.length > 0
      ? {
          reviews: {
            create: seedReviews.map((review) => ({
              id: review.id,
              author: review.userName,
              rating: review.rating,
              comment: review.comment,
              createdAt: new Date(review.date),
            })),
          },
        }
      : {}),
  };
}

function toUpdateData(input: ArtworkUpdateInput) {
  const data: Record<string, unknown> = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.artist !== undefined) data.artist = input.artist;
  if (input.year !== undefined) data.year = input.year;
  if (input.category !== undefined) data.medium = input.category;
  if (input.description !== undefined) data.description = input.description;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
  if (input.price !== undefined) data.price = input.price;
  if ((input as { forSale?: boolean }).forSale !== undefined) data.forSale = (input as { forSale?: boolean }).forSale;
  if ((input as { likes?: number }).likes !== undefined) data.likes = (input as { likes?: number }).likes;

  return data;
}

function buildWhereClause(filters: ArtworkListFilters) {
  const where: Record<string, unknown> = {};

  if (filters.medium) {
    where.medium = { contains: filters.medium, mode: "insensitive" };
  }

  if (filters.forSale !== undefined) {
    where.forSale = filters.forSale;
  }

  if (filters.artist) {
    where.artist = { contains: filters.artist, mode: "insensitive" };
  }

  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    where.price = {
      ...(filters.priceMin !== undefined ? { gte: filters.priceMin } : {}),
      ...(filters.priceMax !== undefined ? { lte: filters.priceMax } : {}),
    };
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { artist: { contains: filters.search, mode: "insensitive" } },
      { medium: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export class PrismaArtworkStore extends InMemoryArtworkStore {
  private readonly prismaClient: PrismaClient;
  private static readonly pendingWrites = new Set<Promise<unknown>>();

  constructor(seedData: ArtworkCreateInput[] = [], prismaClient: PrismaClient = prisma) {
    super([]);
    this.prismaClient = prismaClient;
    this.seed(seedData);
  }

  static async flushPendingWrites() {
    await Promise.all(Array.from(this.pendingWrites));
  }

  private enqueueWrite<T>(operation: Promise<T>) {
    const trackedOperation = operation.catch(() => undefined);
    PrismaArtworkStore.pendingWrites.add(trackedOperation);
    trackedOperation.finally(() => {
      PrismaArtworkStore.pendingWrites.delete(trackedOperation);
    });
  }

  getAll(filters: ArtworkListFilters = {}) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.max(1, filters.pageSize ?? 5);
    const where = buildWhereClause(filters);

    return this.prismaClient.artwork
      .findMany({
        where,
        include: { reviews: true },
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      })
      .then(async (items) => {
        const totalItems = await this.prismaClient.artwork.count({ where });
        return {
          items: items.map(toArtwork),
          pagination: {
            page,
            pageSize,
            totalItems,
            totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
          },
        };
      });
  }

  async getStats(): Promise<ArtworksStats> {
    const [artworkAggregate, reviewAggregate, mediumGroups, forSaleCount] =
      await Promise.all([
        this.prismaClient.artwork.aggregate({
          _count: { _all: true },
          _avg: { price: true },
          _min: { price: true },
          _max: { price: true },
        }),
        this.prismaClient.review.aggregate({
          _count: { _all: true },
          _avg: { rating: true },
        }),
        this.prismaClient.artwork.groupBy({
          by: ["medium"],
          _count: { _all: true },
        }),
        this.prismaClient.artwork.count({ where: { forSale: true } }),
      ]);

    const categoryDistribution = mediumGroups
      .map((group) => ({ category: group.medium, count: group._count._all }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

    // Computed for persistence/reporting requirements, but not exposed in the legacy stats payload.
    void forSaleCount;

    // Keep the frontend contract unchanged while sourcing values from Postgres.
    return {
      totalArtworks: artworkAggregate._count._all,
      averagePrice: Number((artworkAggregate._avg.price ?? 0).toFixed(2)),
      minPrice: Number((artworkAggregate._min.price ?? 0).toFixed(2)),
      maxPrice: Number((artworkAggregate._max.price ?? 0).toFixed(2)),
      categoryDistribution,
      totalReviews: reviewAggregate._count._all,
      averageRating: Number((reviewAggregate._avg.rating ?? 0).toFixed(2)),
    };
  }

  override create(input: ArtworkCreateInput, prepend: boolean = false) {
    const created = super.create(input, prepend);

    this.enqueueWrite(
      this.prismaClient.artwork
      .upsert({
        where: { id: created.id },
        create: toCreateData(input, created.id),
        update: toUpdateData(input),
        include: { reviews: true },
      })
    );

    return created;
  }

  override update(id: string, input: ArtworkUpdateInput) {
    const updated = super.update(id, input);

    if (!updated) {
      return null;
    }

    this.enqueueWrite(this.prismaClient.artwork.update({
      where: { id },
      data: toUpdateData(input),
    }));

    return updated;
  }

  override delete(id: string) {
    const deleted = super.delete(id);

    if (!deleted) {
      return false;
    }

    this.enqueueWrite(this.prismaClient.review.deleteMany({ where: { artworkId: id } }));
    this.enqueueWrite(this.prismaClient.artwork.delete({ where: { id } }));

    return true;
  }

  override addReview(artworkId: string, review: { id: string; userName: string; rating: number; comment: string; date: string }) {
    const created = super.addReview(artworkId, review);

    if (!created) {
      return null;
    }

    this.enqueueWrite(this.prismaClient.review.upsert({
      where: { id: review.id },
      create: {
        id: review.id,
        artworkId,
        author: review.userName,
        rating: review.rating,
        comment: review.comment,
        createdAt: new Date(review.date),
      },
      update: {
        artworkId,
        author: review.userName,
        rating: review.rating,
        comment: review.comment,
      },
    }));

    return created;
  }

  override updateReview(artworkId: string, reviewId: string, data: Partial<{ userName: string; rating: number; comment: string }>) {
    const updated = super.updateReview(artworkId, reviewId, data);

    if (!updated) {
      return null;
    }

    this.enqueueWrite(this.prismaClient.review.update({
      where: { id: reviewId },
      data: {
        ...(data.userName !== undefined ? { author: data.userName } : {}),
        ...(data.rating !== undefined ? { rating: data.rating } : {}),
        ...(data.comment !== undefined ? { comment: data.comment } : {}),
      },
    }));

    return updated;
  }

  override deleteReview(artworkId: string, reviewId: string) {
    const deleted = super.deleteReview(artworkId, reviewId);

    if (!deleted) {
      return false;
    }

    this.enqueueWrite(this.prismaClient.review.delete({ where: { id: reviewId } }));

    return true;
  }
}