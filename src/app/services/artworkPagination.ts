import type { Artwork } from "../data/artworks";
import { getAccessToken } from "./authToken";

export type ArtworkPageQuery = {
  page: number;
  pageSize: number;
  artist?: string;
  category?: string;
  search?: string;
};

export type ArtworkPageResponse = {
  items: Artwork[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

const REQUEST_TIMEOUT_MS = 4000;
const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL ?? ""}/api`;

function buildQueryString(query: ArtworkPageQuery) {
  const params = new URLSearchParams();

  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));

  if (query.artist?.trim()) {
    params.set("artist", query.artist.trim());
  }

  if (query.category?.trim()) {
    params.set("category", query.category.trim());
  }

  if (query.search?.trim()) {
    params.set("search", query.search.trim());
  }

  return params.toString();
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

export async function fetchArtworkPage(query: ArtworkPageQuery) {
  const response = await fetchWithTimeout(
    `${API_BASE_URL}/artworks?${buildQueryString(query)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to load artworks.");
  }

  return (await response.json()) as ArtworkPageResponse;
}
