import type {
  Artwork,
  ArtworkCreateInput,
  ArtworkUpdateInput,
} from "../types";

export class InMemoryArtworkStore {
  private items: Artwork[] = [];

  private nextId = 1;

  constructor(seedData: ArtworkCreateInput[] = []) {
    this.seed(seedData);
  }

  seed(seedData: ArtworkCreateInput[]) {
    this.items = [];
    this.nextId = 1;

    for (const item of seedData) {
      this.create(item);
    }
  }

  listAll() {
    return [...this.items];
  }

  getById(id: string) {
    return this.items.find((item) => item.id === id) ?? null;
  }

  create(input: ArtworkCreateInput, prepend: boolean = false) {
    const id = input.id ?? String(this.nextId++);
    const artwork: Artwork = {
      id,
      title: input.title,
      artist: input.artist,
      year: input.year,
      price: input.price,
      category: input.category,
      description: input.description,
      imageUrl: input.imageUrl,
      likes: (input as any).likes ?? 0,
      reviews: (input as any).reviews ?? [],
    };

    const existingIndex = this.items.findIndex((item) => item.id === id);
    if (existingIndex !== -1) {
      this.items[existingIndex] = artwork;
      return artwork;
    }

    if (prepend) {
      this.items.unshift(artwork);
    } else {
      this.items.push(artwork);
    }

    if (input.id) {
      const parsedId = Number.parseInt(input.id, 10);
      if (Number.isInteger(parsedId)) {
        this.nextId = Math.max(this.nextId, parsedId + 1);
      }
    }

    return artwork;
  }

  update(id: string, input: ArtworkUpdateInput) {
    const index = this.items.findIndex((item) => item.id === id);

    if (index === -1) {
      return null;
    }

    const updated: Artwork = {
      ...this.items[index],
      ...input,
    };

    this.items[index] = updated;
    return updated;
  }

  // Review helpers
  getReviews(artworkId: string) {
    const artwork = this.getById(artworkId);
    return artwork ? [...artwork.reviews] : null;
  }

  addReview(artworkId: string, review: { id: string; userName: string; rating: number; comment: string; date: string }) {
    const artwork = this.getById(artworkId);
    if (!artwork) return null;
    artwork.reviews.push(review);
    return review;
  }

  updateReview(artworkId: string, reviewId: string, data: Partial<{ userName: string; rating: number; comment: string }>) {
    const artwork = this.getById(artworkId);
    if (!artwork) return null;
    const idx = artwork.reviews.findIndex((r) => r.id === reviewId);
    if (idx === -1) return null;
    const updated = { ...artwork.reviews[idx], ...data };
    artwork.reviews[idx] = updated;
    return updated;
  }

  deleteReview(artworkId: string, reviewId: string) {
    const artwork = this.getById(artworkId);
    if (!artwork) return false;
    const idx = artwork.reviews.findIndex((r) => r.id === reviewId);
    if (idx === -1) return false;
    artwork.reviews.splice(idx, 1);
    return true;
  }

  delete(id: string) {
    const index = this.items.findIndex((item) => item.id === id);

    if (index === -1) {
      return false;
    }

    this.items.splice(index, 1);
    return true;
  }
}
