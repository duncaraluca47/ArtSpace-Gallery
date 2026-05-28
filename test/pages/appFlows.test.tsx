/// <reference types="vitest/globals" />

import { fireEvent, render, screen, within } from "@testing-library/react";
import { waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { RouterProvider, createMemoryRouter, type RouteObject } from "react-router";
import { vi } from "vitest";
import { AuthProvider } from "../../src/context/AuthContext";
import { ArtworksProvider } from "../../src/app/context/ArtworksContext";
import { artworks as seedArtworks } from "../../src/app/data/artworks";
import { AddArtworkPage } from "../../src/app/pages/AddArtworkPage";
import { ArtworkDetailPage } from "../../src/app/pages/ArtworkDetailPage";
import { EditArtworkPage } from "../../src/app/pages/EditArtworkPage";
import { GalleryPage } from "../../src/app/pages/GalleryPage";

vi.mock("../../src/context/AuthContext", () => {
  const permissions = ["artwork:create", "artwork:edit", "artwork:delete"];
  const user = {
    id: "admin-id",
    username: "admin",
    email: "admin@example.com",
    role: "admin",
    permissions,
  };

  return {
    AuthProvider: ({ children }: { children: ReactNode }) => children,
    useAuth: () => ({
      user,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      isAdmin: true,
      hasPermission: (permission: string) => permissions.includes(permission),
      isReady: true,
      tokenVersion: 0,
    }),
    useOptionalAuth: () => ({
      user,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      isAdmin: true,
      hasPermission: (permission: string) => permissions.includes(permission),
      isReady: true,
      tokenVersion: 0,
    }),
  };
});

function createAccessToken() {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      id: "admin-id",
      username: "admin",
      email: "admin@example.com",
      role: "admin",
      permissions: ["artwork:create", "artwork:edit", "artwork:delete"],
      tokenType: "access",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    }),
  ).toString("base64url");

  return `${header}.${payload}.signature`;
}

function renderFromRoute(initialEntry: string) {
  const routes: RouteObject[] = [
    { path: "/gallery", Component: GalleryPage },
    { path: "/artwork/:id", Component: ArtworkDetailPage },
    { path: "/add-artwork", Component: AddArtworkPage },
    { path: "/edit-artwork/:id", Component: EditArtworkPage },
  ];

  const router = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
  });

  render(
    <AuthProvider>
      <ArtworksProvider>
        <RouterProvider router={router} />
      </ArtworksProvider>
    </AuthProvider>,
  );
}

describe("application CRUD and gallery flows", () => {
  function buildArtworkPageResponse(url: string) {
    const parsedUrl = new URL(url, "http://localhost");
    const page = Number(parsedUrl.searchParams.get("page") ?? "1");
    const pageSize = Number(parsedUrl.searchParams.get("pageSize") ?? "6");
    const artist = parsedUrl.searchParams.get("artist")?.trim().toLowerCase() ?? "";
    const category = parsedUrl.searchParams.get("category")?.trim().toLowerCase() ?? "";
    const search = parsedUrl.searchParams.get("search")?.trim().toLowerCase() ?? "";

    const filtered = seedArtworks.filter((artwork) => {
      const searchable = `${artwork.title} ${artwork.artist} ${artwork.category}`.toLowerCase();
      const matchesArtist = !artist || artwork.artist.toLowerCase().includes(artist);
      const matchesCategory = !category || artwork.category.toLowerCase().includes(category);
      const matchesSearch = !search || searchable.includes(search);

      return matchesArtist && matchesCategory && matchesSearch;
    });

    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return new Response(
      JSON.stringify({
        items,
        pagination: {
          page,
          pageSize,
          totalItems: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  beforeEach(() => {
    document.cookie = "artspace_preferences=; Max-Age=0; path=/";
    document.cookie = "artspace_activity=; Max-Age=0; path=/";

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/auth/refresh") && method === "POST") {
        return new Response(
          JSON.stringify({
            success: true,
            accessToken: createAccessToken(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.endsWith("/api/auth/me") && method === "GET") {
        return new Response(
          JSON.stringify({
            success: true,
            user: {
              id: "admin-id",
              username: "admin",
              email: "admin@example.com",
              role: "admin",
              permissions: ["artwork:create", "artwork:edit", "artwork:delete"],
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.endsWith("/api/auth/logout") && method === "POST") {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/health") && method === "GET") {
        return new Response(JSON.stringify({ status: "ok", storage: "postgres" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/fake-data/")) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/artworks") && method === "GET") {
        return buildArtworkPageResponse(url);
      }

      if (url.includes("/api/artworks") && method !== "GET") {
        const status = method === "POST" ? 201 : 200;
        return new Response(JSON.stringify({ success: true, id: "mock-artwork" }), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows initial artworks and loads the next batch on demand", async () => {
    const user = userEvent.setup();
    renderFromRoute("/gallery");

    const galleryHeading = await screen.findByRole("heading", { name: "Artwork Gallery" });
    expect(galleryHeading).toBeInTheDocument();

    const pageOneCards = await screen.findAllByRole("article");
    expect(pageOneCards).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: /Load more/i }));

    await waitFor(() => {
      expect(screen.getAllByRole("article").length).toBeGreaterThan(pageOneCards.length);
    });
  });

  it("filters artworks by search term", async () => {
    const user = userEvent.setup();
    renderFromRoute("/gallery");

    await user.click(screen.getByRole("button", { name: /Show Filters/i }));
    await user.type(screen.getByPlaceholderText("Title, artist, category..."), "Watercolor");
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));

    expect(screen.getByText("Watercolor Dreams")).toBeInTheDocument();
    expect(screen.queryByText("Abstract Emotions")).not.toBeInTheDocument();
  });

  it("creates a new artwork and navigates to detail", async () => {
    const user = userEvent.setup();
    renderFromRoute("/add-artwork");

    await user.type(screen.getByLabelText("Title"), "Testing Sunrise");
    await user.type(screen.getByLabelText("Artist"), "Raluca Test");
    await user.type(screen.getByLabelText("Year"), "2026");
    await user.type(screen.getByLabelText("Price"), "4500");
    await user.type(screen.getByLabelText("Category"), "Impressionist");
    await user.type(
      screen.getByLabelText("Description"),
      "This is a valid description for integration test coverage.",
    );
    await user.type(screen.getByLabelText("Artwork Image URL"), "https://example.com/sunrise.jpg");

    await user.click(screen.getByRole("button", { name: "Save Artwork" }));

    expect(await screen.findByRole("heading", { name: "Testing Sunrise" })).toBeInTheDocument();
    expect(screen.getByText("Raluca Test")).toBeInTheDocument();
  });

  it("edits an existing artwork and persists changes", async () => {
    const user = userEvent.setup();
    renderFromRoute("/edit-artwork/1");

    const titleInput = await screen.findByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Abstract Emotions Updated");

    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(
      await screen.findByRole("heading", { name: "Abstract Emotions Updated" }),
    ).toBeInTheDocument();
  });

  it("deletes an artwork after confirmation and returns to gallery", async () => {
    const user = userEvent.setup();
    renderFromRoute("/artwork/1");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const modal = await screen.findByRole("heading", { name: "Delete Artwork" });
    expect(modal).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Permanently" }));

    expect(await screen.findByRole("heading", { name: "Artwork Gallery" })).toBeInTheDocument();

    const cards = screen.getAllByRole("article");
    const hasDeletedTitle = cards.some((card) =>
      within(card).queryByText("Abstract Emotions"),
    );
    expect(hasDeletedTitle).toBe(false);
  });

  it("shows not found state for a missing artwork id", async () => {
    renderFromRoute("/artwork/missing-id");

    expect(await screen.findByRole("heading", { name: "Artwork not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Gallery" })).toBeInTheDocument();
  });

  it("opens and closes review modal from detail page", async () => {
    const user = userEvent.setup();
    renderFromRoute("/artwork/1");

    await user.click(screen.getByRole("button", { name: "Write a Review" }));
    expect(await screen.findByRole("heading", { name: "Write a Review" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("heading", { name: "Write a Review" })).not.toBeInTheDocument();
  });

  it("switches list and stats views and toggles stats chart types", async () => {
    const user = userEvent.setup();
    renderFromRoute("/gallery");

    await user.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("columnheader", { name: "Title" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stats" }));
    expect(await screen.findByRole("heading", { name: "Statistics" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Artists" }));
    expect(screen.queryByRole("heading", { name: "Price vs Likes" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ratings" }));
    await user.click(screen.getByRole("button", { name: "Years" }));
    await user.click(screen.getByRole("button", { name: "Likes" }));
    expect(screen.getByRole("heading", { name: "Price vs Likes" })).toBeInTheDocument();
  });

  it("opens surprise modal, toggles like, retries and closes with Escape", async () => {
    const user = userEvent.setup();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    renderFromRoute("/gallery");

    await user.click(screen.getByRole("button", { name: "Surprise Me" }));
    expect(await screen.findByRole("button", { name: "Try Another" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Like" }));
    expect(screen.getByRole("button", { name: "Liked" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try Another" }));
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    });

    randomSpy.mockRestore();
  });

  it("supports split view quick add, inline edit validation, and delete confirm flows", async () => {
    const user = userEvent.setup();
    renderFromRoute("/gallery");

    await user.click(screen.getByRole("button", { name: "Split" }));
    await user.click(screen.getByRole("button", { name: "Quick Add" }));

    await user.click(screen.getByRole("button", { name: "Add Artwork" }));
    expect(screen.getByText("Please correct invalid fields before adding.")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Title"), "Inline Test Artwork");
    await user.type(screen.getByPlaceholderText("Artist"), "Inline Artist");
    await user.type(screen.getByPlaceholderText("Year"), "2024");
    await user.type(screen.getByPlaceholderText("Price"), "1200");
    await user.type(screen.getByPlaceholderText("Category"), "Test");
    await user.type(screen.getByPlaceholderText("Image URL"), "https://example.com/inline.jpg");
    await user.type(
      screen.getByPlaceholderText("Description"),
      "Inline form description is long enough for valid submission.",
    );
    await user.click(screen.getByRole("button", { name: "Add Artwork" }));

    expect(screen.getByText("Inline Test Artwork")).toBeInTheDocument();

    const inlineTitleCell = screen.getByText("Inline Test Artwork");
    const inlineRow = inlineTitleCell.closest("tr");
    expect(inlineRow).not.toBeNull();

    const editButton = within(inlineRow as HTMLElement).getByRole("button", { name: "Edit" });
    await user.click(editButton);

    const saveButton = screen.getByRole("button", { name: "Save Changes" });
    const editForm = saveButton.closest("form") as HTMLElement;
    const editTitleInput = within(editForm).getByPlaceholderText("Title");
    await user.clear(editTitleInput);
    await user.click(saveButton);
    expect(screen.getByText("Please correct invalid fields before saving.")).toBeInTheDocument();

    await user.type(editTitleInput, "Inline Updated Artwork");
    await user.click(saveButton);
    expect(screen.getByText("Inline Updated Artwork")).toBeInTheDocument();

    const confirmSpy = vi.spyOn(window, "confirm");
    confirmSpy.mockReturnValue(false);
    const updatedRow = screen.getByText("Inline Updated Artwork").closest("tr") as HTMLElement;
    await user.click(within(updatedRow).getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Inline Updated Artwork")).toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    await user.click(within(updatedRow).getByRole("button", { name: "Delete" }));
    expect(screen.queryByText("Inline Updated Artwork")).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  }, 15000);

  it("shows not found state for a missing edit artwork id", async () => {
    renderFromRoute("/edit-artwork/missing-id");

    expect(await screen.findByRole("heading", { name: "Artwork not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Gallery" })).toBeInTheDocument();
  });

  it("shows validation errors on add page for invalid submit", async () => {
    renderFromRoute("/add-artwork");

    const form = screen.getByRole("button", { name: "Save Artwork" }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(screen.getByText("Title is required.")).toBeInTheDocument();
    expect(screen.getByText("Artist is required.")).toBeInTheDocument();
    expect(screen.getByText("Category is required.")).toBeInTheDocument();
  });

  it("uses edit page validation and image fallback behavior", async () => {
    const user = userEvent.setup();
    renderFromRoute("/edit-artwork/1");

    const imageUrlInput = await screen.findByLabelText("Artwork Image URL");
    await user.clear(imageUrlInput);

    const previewImage = screen.getByAltText("Abstract Emotions") as HTMLImageElement;
    expect(previewImage.src).toContain("ik.imagekit.io");

    const descriptionInput = screen.getByLabelText("Description");
    await user.clear(descriptionInput);

    const form = screen.getByRole("button", { name: "Save Changes" }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(screen.getByText("Description is required.")).toBeInTheDocument();
  });

  it("toggles detail like state, submits review, and expands long description", async () => {
    const user = userEvent.setup();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    renderFromRoute("/add-artwork");

    await user.type(screen.getByLabelText("Title"), "Very Long Description Artwork");
    await user.type(screen.getByLabelText("Artist"), "Coverage Artist");
    await user.type(screen.getByLabelText("Year"), "2026");
    await user.type(screen.getByLabelText("Price"), "5600");
    await user.type(screen.getByLabelText("Category"), "Narrative");
    await user.type(
      screen.getByLabelText("Description"),
      "This description is intentionally very long to trigger the expandable detail behavior. It keeps going so the component can render the More action and then Show less after expansion in the detail page flow.",
    );
    await user.type(
      screen.getByLabelText("Artwork Image URL"),
      "https://example.com/very-long.jpg",
    );

    await user.click(screen.getByRole("button", { name: "Save Artwork" }));

    await user.click(screen.getByRole("button", { name: "Like" }));
    expect(screen.getByRole("button", { name: "Liked" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Write a Review" }));
    await user.type(
      screen.getByPlaceholderText("What did you think about this artwork?"),
      "Great composition and thoughtful narrative balance.",
    );
    await user.click(screen.getByRole("button", { name: "Submit Review" }));
    expect(logSpy).toHaveBeenCalled();

    const moreButton = screen.queryByRole("button", { name: "More" });
    if (moreButton) {
      await user.click(moreButton);
      expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
    }

    logSpy.mockRestore();
  }, 15000);

});
