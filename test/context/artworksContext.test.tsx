/// <reference types="vitest/globals" />

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArtworksProvider, useArtworks } from "../../src/app/context/ArtworksContext";
import type { ArtworkDraft } from "../../src/app/state/artworksStore";

function Consumer() {
  const { artworks } = useArtworks();
  return <p>count:{artworks.length}</p>;
}

function SyncConsumer() {
  const { artworks, addArtwork, syncStatus } = useArtworks();

  const draft: ArtworkDraft = {
    title: "Offline Sync Test",
    artist: "Test Artist",
    year: 2026,
    price: 2400,
    category: "Test",
    description: "This description is long enough to satisfy validation rules.",
    imageUrl: "https://example.com/offline-sync.jpg",
  };

  return (
    <div>
      <p data-testid="status">{syncStatus.mode}:{syncStatus.pendingOperations}</p>
      <p data-testid="count">{artworks.length}</p>
      <p data-testid="last-id">{artworks.at(-1)?.id ?? "none"}</p>
      <button type="button" onClick={() => addArtwork(draft)}>
        Add Offline Artwork
      </button>
    </div>
  );
}

describe("ArtworksContext", () => {
  it("throws when hook is used without provider", () => {
    expect(() => render(<Consumer />)).toThrow("useArtworks must be used inside ArtworksProvider");
  });

  it("provides artworks when used inside provider", () => {
    render(
      <ArtworksProvider>
        <Consumer />
      </ArtworksProvider>,
    );

    expect(screen.getByText(/count:/)).toBeInTheDocument();
  });

  it("queues artwork changes offline and replays them when back online", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.endsWith("/health")) {
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/artworks") && init?.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}")) as { id?: string };
        return new Response(JSON.stringify({ id: body.id ?? "server-id" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(null, { status: 204 });
    });

    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window.navigator, "onLine", {
      value: false,
      configurable: true,
    });

    render(
      <ArtworksProvider>
        <SyncConsumer />
      </ArtworksProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Add Offline Artwork" }));
    });

    expect(screen.getByTestId("count")).toHaveTextContent("8");
    expect(screen.getByTestId("status")).toHaveTextContent("offline:1");
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/artworks"), expect.anything());

    Object.defineProperty(window.navigator, "onLine", {
      value: true,
      configurable: true,
    });
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("online:0");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/health"),
      expect.objectContaining({ method: "GET" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/artworks"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
