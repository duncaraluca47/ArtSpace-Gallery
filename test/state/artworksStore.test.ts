/// <reference types="vitest/globals" />

import { artworks as seedArtworks } from "../../src/app/data/artworks";
import {
  addArtworkToList,
  createArtwork,
  removeArtworkById,
  updateArtworkById,
  type ArtworkDraft,
} from "../../src/app/state/artworksStore";

describe("artworksStore", () => {
  const draft: ArtworkDraft = {
    title: "New Piece",
    artist: "Ioana",
    year: 2026,
    price: 3200,
    category: "Modern",
    description: "A brand new painting for testing in-memory CRUD operations.",
    imageUrl: "https://example.com/new-piece.jpg",
  };

  it("creates artwork with generated id and defaults", () => {
    const artwork = createArtwork(draft);

    expect(artwork.id).toBeTruthy();
    expect(artwork.likes).toBe(0);
    expect(artwork.reviews).toEqual([]);
    expect(artwork.title).toBe("New Piece");
  });

  it("adds artwork immutably", () => {
    const list = seedArtworks.slice(0, 2);
    const next = addArtworkToList(list, draft);

    expect(next).toHaveLength(3);
    expect(list).toHaveLength(2);
    expect(next[2].title).toBe("New Piece");
  });

  it("updates artwork by id immutably", () => {
    const list = seedArtworks.slice(0, 2);
    const next = updateArtworkById(list, list[0].id, {
      ...draft,
      title: "Updated",
      artist: "Updated Artist",
    });

    expect(next).toHaveLength(2);
    expect(next[0].title).toBe("Updated");
    expect(next[1]).toEqual(list[1]);
    expect(list[0].title).not.toBe("Updated");
  });

  it("returns original list when update target is missing", () => {
    const list = seedArtworks.slice(0, 2);
    const next = updateArtworkById(list, "missing", draft);

    expect(next).toBe(list);
  });

  it("removes artwork by id immutably", () => {
    const list = seedArtworks.slice(0, 3);
    const next = removeArtworkById(list, list[1].id);

    expect(next).toHaveLength(2);
    expect(next.find((art) => art.id === list[1].id)).toBeUndefined();
    expect(list).toHaveLength(3);
  });

  it("returns original list when delete target is missing", () => {
    const list = seedArtworks.slice(0, 2);
    const next = removeArtworkById(list, "missing");

    expect(next).toBe(list);
  });
});
