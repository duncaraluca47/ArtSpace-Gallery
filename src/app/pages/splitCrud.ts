import type { Artwork } from "../data/artworks";
import { createArtwork, type ArtworkDraft } from "../state/artworksStore";

export function getSplitSource(current: Artwork[] | null, fallback: Artwork[]) {
  return current ?? fallback;
}

export function addTemporarySplitArtwork(current: Artwork[] | null, fallback: Artwork[], draft: ArtworkDraft) {
  const source = getSplitSource(current, fallback);
  return [...source, createArtwork(draft)];
}

export function updateTemporarySplitArtwork(
  current: Artwork[] | null,
  fallback: Artwork[],
  id: string,
  draft: ArtworkDraft,
) {
  const source = getSplitSource(current, fallback);
  return source.map((artwork) => (artwork.id === id ? { ...artwork, ...draft } : artwork));
}

export function removeTemporarySplitArtwork(current: Artwork[] | null, fallback: Artwork[], id: string) {
  const source = getSplitSource(current, fallback);
  return source.filter((item) => item.id !== id);
}