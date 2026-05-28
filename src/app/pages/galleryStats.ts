import type { Artwork } from "../data/artworks";
import { getAverageRating } from "./galleryLogic";

export function buildPriceRanges(artworks: Artwork[]) {
  return [
    { name: "$0-1,000", count: artworks.filter((a) => a.price <= 1000).length },
    { name: "$1,001-5,000", count: artworks.filter((a) => a.price > 1000 && a.price <= 5000).length },
    { name: "$5,001-10,000", count: artworks.filter((a) => a.price > 5000 && a.price <= 10000).length },
    { name: "$10,001-25,000", count: artworks.filter((a) => a.price > 10000 && a.price <= 25000).length },
    { name: "$25,001+", count: artworks.filter((a) => a.price > 25000).length },
  ];
}

export function buildArtistData(artworks: Artwork[]) {
  return Object.entries(
    artworks.reduce((acc, item) => {
      acc[item.artist] = (acc[item.artist] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  ).map(([name, count]) => ({ name, count }));
}

export function buildRatingData(artworks: Artwork[]) {
  return [
    { name: "0?", count: artworks.filter((a) => a.reviews.length === 0).length },
    { name: "1?", count: artworks.filter((a) => { const avg = getAverageRating(a); return avg >= 0.5 && avg < 1.5; }).length },
    { name: "2?", count: artworks.filter((a) => { const avg = getAverageRating(a); return avg >= 1.5 && avg < 2.5; }).length },
    { name: "3?", count: artworks.filter((a) => { const avg = getAverageRating(a); return avg >= 2.5 && avg < 3.5; }).length },
    { name: "4?", count: artworks.filter((a) => { const avg = getAverageRating(a); return avg >= 3.5 && avg < 4.5; }).length },
    { name: "5?", count: artworks.filter((a) => getAverageRating(a) >= 4.5).length },
  ];
}

export function buildYearData(artworks: Artwork[]) {
  return artworks
    .reduce((acc, art) => {
      const year = String(art.year);
      const found = acc.find((item) => item.name === year);
      if (found) {
        found.count += 1;
      } else {
        acc.push({ name: year, count: 1 });
      }
      return acc;
    }, [] as Array<{ name: string; count: number }> )
    .sort((a, b) => Number(a.name) - Number(b.name));
}

export function buildLikesData(artworks: Artwork[]) {
  return [
    { name: "0-10", count: artworks.filter((a) => a.likes <= 10).length },
    { name: "11-25", count: artworks.filter((a) => a.likes > 10 && a.likes <= 25).length },
    { name: "26-50", count: artworks.filter((a) => a.likes > 25 && a.likes <= 50).length },
    { name: "51-100", count: artworks.filter((a) => a.likes > 50 && a.likes <= 100).length },
    { name: "100+", count: artworks.filter((a) => a.likes > 100).length },
  ];
}

export function buildScatterData(artworks: Artwork[]) {
  return artworks.map((art) => ({
    price: art.price,
    likes: art.likes,
    rating: getAverageRating(art),
  }));
}

export function summarizeArtworks(artworks: Artwork[]) {
  const totalArtworks = artworks.length;
  const averagePrice = totalArtworks === 0 ? 0 : artworks.reduce((sum, art) => sum + art.price, 0) / totalArtworks;
  const averageRating = totalArtworks === 0 ? 0 : artworks.reduce((sum, art) => sum + getAverageRating(art), 0) / totalArtworks;
  const totalLikes = artworks.reduce((sum, art) => sum + art.likes, 0);
  const uniqueArtists = new Set(artworks.map((a) => a.artist)).size;
  const maxPrice = totalArtworks === 0 ? 0 : Math.max(...artworks.map((a) => a.price));
  const minPrice = totalArtworks === 0 ? 0 : Math.min(...artworks.map((a) => a.price));

  return {
    totalArtworks,
    averagePrice,
    averageRating,
    totalLikes,
    uniqueArtists,
    maxPrice,
    minPrice,
  };
}
