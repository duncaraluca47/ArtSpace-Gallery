/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { AuthProvider } from "../../src/context/AuthContext";
import { LoginPage } from "../../src/components/LoginPage";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";

function ProtectedHome() {
  return <h1>Home</h1>;
}

function renderLoginRoute() {
  const routes: RouteObject[] = [
    { path: "/login", Component: LoginPage },
    { path: "/", element: <ProtectedHome /> },
  ];

  const router = createMemoryRouter(routes, { initialEntries: ["/login"] });

  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );

  return router;
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/auth/refresh") && method === "POST") {
        return new Response(JSON.stringify({ message: "refresh required" }), { status: 401, headers: { "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ message: "Unexpected" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders username and password fields and a submit button", async () => {
    renderLoginRoute();

    expect(await screen.findByLabelText(/Username|Email/)).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });

  it("shows an error message when invalid credentials are submitted", async () => {
    // stub login to return 401
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/auth/refresh") && method === "POST") {
        return new Response(JSON.stringify({ message: "refresh required" }), { status: 401, headers: { "Content-Type": "application/json" } });
      }

      if (url.endsWith("/api/auth/login") && method === "POST") {
        return new Response(JSON.stringify({ message: "Invalid" }), { status: 401, headers: { "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ message: "Unexpected" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }));

    renderLoginRoute();
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: /login/i });

    await user.type(screen.getByLabelText(/Username|Email/), "baduser");
    await user.type(screen.getByLabelText("Password"), "wrongpass");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Invalid username or password./i);
  });

  it("redirects to home on successful login", async () => {
    // stub successful login
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/auth/refresh") && method === "POST") {
        return new Response(JSON.stringify({ message: "refresh required" }), { status: 401, headers: { "Content-Type": "application/json" } });
      }

      if (url.endsWith("/api/auth/login") && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { username: string };
        const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
        const payload = btoa(JSON.stringify({ id: `${body.username}-id`, username: body.username, email: `${body.username}@example.com`, role: "user", permissions: [], tokenType: "access", exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) }));
        const accessToken = `${header}.${payload}.signature`;

        return new Response(JSON.stringify({ success: true, accessToken, user: { id: `${body.username}-id`, username: body.username, email: `${body.username}@example.com`, role: "user", permissions: [] } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ message: "Unexpected" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }));

    renderLoginRoute();
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: /login/i });

    await user.type(screen.getByLabelText(/Username|Email/), "gooduser");
    await user.type(screen.getByLabelText("Password"), "rightpass");
    await user.click(screen.getByRole("button", { name: /login/i }));

    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
  });
});
