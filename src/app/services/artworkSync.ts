import type { Artwork } from "../data/artworks";
import { artworks as seedArtworks } from "../data/artworks";
import type { ArtworkDraft } from "../state/artworksStore";
import { getAccessToken } from "./authToken";

export type ArtworkSyncOperation =
  | {
      id: string;
      type: "create";
      artwork: Artwork;
    }
  | {
      id: string;
      type: "update";
      artworkId: string;
      draft: ArtworkDraft;
    }
  | {
      id: string;
      type: "delete";
      artworkId: string;
    };
  
// extend with review operations for client-side sync queue
export type ArtworkSyncOperationExtended =
  | ArtworkSyncOperation
  | {
      id: string;
      type: "review:create";
      artworkId: string;
      review: { id: string; userName: string; rating: number; comment: string; date: string };
    }
  | {
      id: string;
      type: "review:update";
      artworkId: string;
      reviewId: string;
      data: Partial<{ userName: string; rating: number; comment: string }>;
    }
  | {
      id: string;
      type: "review:delete";
      artworkId: string;
      reviewId: string;
    };

export type ArtworkSyncStatus = {
  mode: "online" | "offline" | "syncing";
  pendingOperations: number;
  lastError: string | null;
};

const ARTWORKS_STORAGE_KEY = "artspace_artworks_snapshot";
const OPERATIONS_STORAGE_KEY = "artspace_artwork_sync_queue";
const REQUEST_TIMEOUT_MS = 4000;
const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL ?? ""}/api`;

function isBrowserStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function cloneReview(review: Artwork["reviews"][number]) {
  return { ...review };
}

export function cloneArtwork(artwork: Artwork): Artwork {
  return {
    ...artwork,
    reviews: artwork.reviews.map(cloneReview),
  };
}

export function cloneArtworks(artworks: Artwork[]): Artwork[] {
  return artworks.map(cloneArtwork);
}

export function createSeedArtworksSnapshot(): Artwork[] {
  return cloneArtworks(seedArtworks);
}

function readJson<T>(key: string): T | null {
  if (!isBrowserStorageAvailable()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

export function loadPersistedArtworks(): Artwork[] | null {
  const snapshot = readJson<Artwork[]>(ARTWORKS_STORAGE_KEY);
  return snapshot ? cloneArtworks(snapshot) : null;
}

export function savePersistedArtworks(artworks: Artwork[]) {
  writeJson(ARTWORKS_STORAGE_KEY, artworks);
}

export function loadPersistedOperations(): ArtworkSyncOperationExtended[] {
  return readJson<ArtworkSyncOperationExtended[]>(OPERATIONS_STORAGE_KEY) ?? [];
}

export function savePersistedOperations(operations: ArtworkSyncOperationExtended[]) {
  writeJson(OPERATIONS_STORAGE_KEY, operations);
}

function backendUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

async function fetchWithTimeout(input: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${getAccessToken() ?? ""}`);

  try {
    return await fetch(input, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function probeArtworkServer() {
  const response = await fetchWithTimeout(backendUrl("/health"), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Server unreachable.");
  }
}

export async function syncArtworkOperation(operation: ArtworkSyncOperationExtended) {
  switch (operation.type) {
    case "create": {
      const { id, likes, reviews, ...payload } = operation.artwork;
      const response = await fetchWithTimeout(backendUrl("/artworks"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, ...payload }),
      });

      if (!response.ok) {
        throw new Error("Failed to sync artwork creation.");
      }

      return;
    }
    case "update": {
      const response = await fetchWithTimeout(backendUrl(`/artworks/${operation.artworkId}`), {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(operation.draft),
      });

      if (!response.ok) {
        throw new Error("Failed to sync artwork update.");
      }

      return;
    }
    case "delete": {
      const response = await fetchWithTimeout(backendUrl(`/artworks/${operation.artworkId}`), {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok && response.status !== 404) {
        throw new Error("Failed to sync artwork deletion.");
      }

      return;
    }
    case "review:create": {
      const response = await fetchWithTimeout(backendUrl(`/artworks/${operation.artworkId}/reviews`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: operation.review.userName, rating: operation.review.rating, comment: operation.review.comment }),
      });

      if (!response.ok) {
        throw new Error("Failed to sync review creation.");
      }

      return;
    }
    case "review:update": {
      const response = await fetchWithTimeout(backendUrl(`/artworks/${operation.artworkId}/reviews/${operation.reviewId}`), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(operation.data),
      });

      if (!response.ok) {
        throw new Error("Failed to sync review update.");
      }

      return;
    }
    case "review:delete": {
      const response = await fetchWithTimeout(backendUrl(`/artworks/${operation.artworkId}/reviews/${operation.reviewId}`), {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok && response.status !== 204 && response.status !== 404) {
        throw new Error("Failed to sync review deletion.");
      }

      return;
    }
    default:
      return;
  }
}

export function describeSyncError(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "Server unreachable.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Server unreachable.";
}