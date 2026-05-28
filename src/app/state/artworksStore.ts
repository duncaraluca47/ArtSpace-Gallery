import type { Artwork } from "../data/artworks";

export type ArtworkDraft = Pick<
  Artwork,
  "title" | "artist" | "year" | "price" | "category" | "description" | "imageUrl"
>;

function generateArtworkId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createArtwork(draft: ArtworkDraft): Artwork {
  return {
    id: generateArtworkId(),
    ...draft,
    likes: 0,
    reviews: [],
  };
}

export function addArtworkToList(list: Artwork[], draft: ArtworkDraft): Artwork[] {
  return [...list, createArtwork(draft)];
}

export function updateArtworkById(
  list: Artwork[],
  id: string,
  draft: ArtworkDraft,
): Artwork[] {
  let found = false;

  const next = list.map((artwork) => {
    if (artwork.id !== id) {
      return artwork;
    }

    found = true;
    return {
      ...artwork,
      ...draft,
    };
  });

  return found ? next : list;
}

export function removeArtworkById(list: Artwork[], id: string): Artwork[] {
  const next = list.filter((artwork) => artwork.id !== id);
  return next.length === list.length ? list : next;
}
