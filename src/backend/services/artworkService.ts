import type {
  ArtworksStats,
  Artwork,
  ArtworkCreateInput,
  ArtworkListQuery,
  ArtworkListResponse,
  ArtworkUpdateInput,
} from "../types";
import { InMemoryArtworkStore } from "../store/inMemoryArtworkStore";
import { PrismaArtworkStore } from "../../prismaArtworkStore";

export class ArtworkService {
  private readonly store: InMemoryArtworkStore | PrismaArtworkStore;

  constructor(store: InMemoryArtworkStore | PrismaArtworkStore) {
    this.store = store;
  }

  list(query: ArtworkListQuery): ArtworkListResponse {
    const normalizedQuery = {
      artist: query.artist?.toLowerCase(),
      category: query.category?.toLowerCase(),
      search: query.search?.toLowerCase(),
    };

    const filtered = this.store.listAll().filter((item) => {
      const matchesArtist = normalizedQuery.artist
        ? item.artist.toLowerCase().includes(normalizedQuery.artist)
        : true;
      const matchesCategory = normalizedQuery.category
        ? item.category.toLowerCase().includes(normalizedQuery.category)
        : true;
      const matchesSearch = normalizedQuery.search
        ? [item.title, item.artist, item.category, item.description]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery.search)
        : true;

      return matchesArtist && matchesCategory && matchesSearch;
    });

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const startIndex = (page - 1) * query.pageSize;
    const items = filtered.slice(startIndex, startIndex + query.pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  getById(id: string) {
    return this.store.getById(id);
  }

  create(input: ArtworkCreateInput, prepend: boolean = true) {
    return this.store.create(input, prepend);
  }

  update(id: string, input: ArtworkUpdateInput) {
    return this.store.update(id, input);
  }

  remove(id: string) {
    return this.store.delete(id);
  }

  async getStats(): Promise<ArtworksStats> {
    if (this.store instanceof PrismaArtworkStore) {
      return this.store.getStats();
    }

    const items = this.store.listAll();

    if (items.length === 0) {
      return {
        totalArtworks: 0,
        averagePrice: 0,
        minPrice: 0,
        maxPrice: 0,
        categoryDistribution: [],
      };
    }

    const prices = items.map((item) => item.price);
    const totalPrice = prices.reduce((sum, value) => sum + value, 0);

    const categoryMap = new Map<string, number>();
    for (const item of items) {
      categoryMap.set(item.category, (categoryMap.get(item.category) ?? 0) + 1);
    }

    const categoryDistribution = Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

    // Reviews summary
    const allReviews = items.flatMap((i) => i.reviews ?? []);
    const totalReviews = allReviews.length;
    const averageRating = totalReviews === 0 ? 0 : Number((allReviews.reduce((s, r) => s + r.rating, 0) / totalReviews).toFixed(2));

    return {
      totalArtworks: items.length,
      averagePrice: Number((totalPrice / items.length).toFixed(2)),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      categoryDistribution,
      totalReviews,
      averageRating,
    };
  }


  // Reviews API
  listReviews(artworkId: string) {
    return this.store.getReviews(artworkId);
  }

  createReview(artworkId: string, review: { id: string; userName: string; rating: number; comment: string; date: string }) {
    return this.store.addReview(artworkId, review);
  }

  updateReview(artworkId: string, reviewId: string, data: Partial<{ userName: string; rating: number; comment: string }>) {
    return this.store.updateReview(artworkId, reviewId, data);
  }

  deleteReview(artworkId: string, reviewId: string) {
    return this.store.deleteReview(artworkId, reviewId);
  }

  getStoreSnapshot(): Artwork[] {
    return this.store.listAll();
  }
}
