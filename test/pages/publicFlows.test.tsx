/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, type RouteObject } from "react-router";
import { ArtworksProvider } from "../../src/app/context/ArtworksContext";
import { GalleryPage } from "../../src/app/pages/GalleryPage";
import { LandingPage } from "../../src/app/pages/LandingPage";
import { LoginPage } from "../../src/components/LoginPage";
import { RegisterPage } from "../../src/components/RegisterPage";

function renderPublicRoutes(initialEntry: string) {
  const routes: RouteObject[] = [
    { path: "/", Component: LandingPage },
    { path: "/gallery", Component: GalleryPage },
    { path: "/login", Component: LoginPage },
    { path: "/register", Component: RegisterPage },
  ];

  const router = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
  });

  render(
    <ArtworksProvider>
      <RouterProvider router={router} />
    </ArtworksProvider>,
  );
}

describe("public pages and auth validation", () => {
  it("renders landing page with at least 3 featured artworks and navigates to gallery", async () => {
    const user = userEvent.setup();
    renderPublicRoutes("/");

    expect(
      screen.getByRole("heading", { name: "ArtSpace Gallery" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Featured Artworks" })).toBeInTheDocument();

    const featuredLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/artwork/"));
    expect(featuredLinks.length).toBeGreaterThanOrEqual(3);

    await user.click(screen.getByRole("link", { name: /Browse Gallery/i }));
    expect(await screen.findByRole("heading", { name: "Artwork Gallery" })).toBeInTheDocument();
  });

  it("validates login form errors and success state", async () => {
    const user = userEvent.setup();
    renderPublicRoutes("/login");

    await user.click(screen.getByRole("button", { name: "Login" }));
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(
      await screen.findByText(/Form is valid\. Authentication backend is not part of this assignment\./i),
    ).toBeInTheDocument();
  });

  it("validates register confirm password and success state", async () => {
    const user = userEvent.setup();
    renderPublicRoutes("/register");

    await user.type(screen.getByLabelText("Username"), "artistUser");
    await user.type(screen.getByLabelText("Email"), "artist@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "mismatch123");
    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Confirm Password"));
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(
      await screen.findByText(/Registration data is valid\. Authentication backend is not part of this assignment\./i),
    ).toBeInTheDocument();
  });
});
