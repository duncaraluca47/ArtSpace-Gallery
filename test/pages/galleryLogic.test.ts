/// <reference types="vitest/globals" />

import { artworks } from "../../src/app/data/artworks";
import {
  filterArtworks,
  getAverageRating,
  sortArtworks,
  type SortOption,
} from "../../src/app/pages/galleryLogic";

describe("galleryLogic", () => {
  it("computes average rating and handles empty reviews", () => {
    expect(getAverageRating(artworks[0])).toBeGreaterThan(0);
    expect(
      getAverageRating({
        ...artworks[0],
        reviews: [],
      }),
    ).toBe(0);
  });

  it("filters by search, rating, and price", () => {
    const result = filterArtworks(artworks, "watercolor", 4, 10000, 12000);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Watercolor Dreams");
  });

  it("sorts artworks across all supported sort options", () => {
    const options: SortOption[] = [
      "newest-first",
      "year-asc",
      "year-desc",
      "price-asc",
      "price-desc",
      "likes-asc",
      "likes-desc",
      "reviews-asc",
      "reviews-desc",
      "rating-asc",
      "rating-desc",
    ];

    for (const option of options) {
      const sorted = sortArtworks(artworks, option);
      expect(sorted).toHaveLength(artworks.length);
    }

    const priceAsc = sortArtworks(artworks, "price-asc");
    const priceDesc = sortArtworks(artworks, "price-desc");
    const yearAsc = sortArtworks(artworks, "year-asc");
    const yearDesc = sortArtworks(artworks, "year-desc");
    const newestFirst = sortArtworks(artworks, "newest-first");

    expect(priceAsc[0].price).toBeLessThanOrEqual(priceAsc[1].price);
    expect(priceDesc[0].price).toBeGreaterThanOrEqual(priceDesc[1].price);
    expect(yearAsc[0].year).toBeLessThanOrEqual(yearAsc[1].year);
    expect(yearDesc[0].year).toBeGreaterThanOrEqual(yearDesc[1].year);
    expect(newestFirst[0].id).toBe(artworks[artworks.length - 1].id);
  });
});
