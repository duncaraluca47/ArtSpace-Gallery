import type { Artwork } from "../data/artworks";

export type SortOption =
  | "newest-first"
  | "price-asc"
  | "price-desc"
  | "year-asc"
  | "year-desc"
  | "likes-asc"
  | "likes-desc"
  | "reviews-asc"
  | "reviews-desc"
  | "rating-asc"
  | "rating-desc";

export type ViewMode = "grid" | "list" | "stats" | "split";

export function getAverageRating(artwork: Artwork) {
  if (artwork.reviews.length === 0) {
    return 0;
  }

  const sum = artwork.reviews.reduce((acc, review) => acc + review.rating, 0);
  return sum / artwork.reviews.length;
}

export function filterArtworks(
  artworks: Artwork[],
  searchTerm: string,
  minRating: number,
  minPrice: number,
  maxPrice: number,
) {
  const normalized = searchTerm.trim().toLowerCase();

  return artworks.filter((artwork) => {
    const rating = getAverageRating(artwork);
    const matchesSearch =
      !normalized ||
      artwork.title.toLowerCase().includes(normalized) ||
      artwork.artist.toLowerCase().includes(normalized) ||
      artwork.category.toLowerCase().includes(normalized) ||
      artwork.description.toLowerCase().includes(normalized);
    const matchesRating = rating >= minRating;
    const matchesPrice = artwork.price >= minPrice && artwork.price <= maxPrice;
    return matchesSearch && matchesRating && matchesPrice;
  });
}

export function sortArtworks(artworks: Artwork[], sortBy: SortOption) {
  const next = [...artworks];
  const positions = new Map(artworks.map((artwork, index) => [artwork.id, index]));

  next.sort((a, b) => {
    switch (sortBy) {
      case "newest-first":
        return (positions.get(b.id) ?? 0) - (positions.get(a.id) ?? 0);
      case "price-asc":
        return a.price - b.price;
      case "price-desc":
        return b.price - a.price;
      case "year-asc":
        return a.year - b.year;
      case "year-desc":
        return b.year - a.year;
      case "likes-asc":
        return a.likes - b.likes;
      case "likes-desc":
        return b.likes - a.likes;
      case "reviews-asc":
        return a.reviews.length - b.reviews.length;
      case "reviews-desc":
        return b.reviews.length - a.reviews.length;
      case "rating-asc":
        return getAverageRating(a) - getAverageRating(b);
      case "rating-desc":
        return getAverageRating(b) - getAverageRating(a);
      default:
        return 0;
    }
  });

  return next;
}
