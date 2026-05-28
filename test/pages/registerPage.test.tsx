/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { AuthProvider } from "../../src/context/AuthContext";
import { RegisterPage } from "../../src/components/RegisterPage";
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";

function ProtectedHome() {
  return <h1>Home</h1>;
}

function renderRegisterRoute() {
  const routes: RouteObject[] = [
    { path: "/register", Component: RegisterPage },
    { path: "/", element: <ProtectedHome /> },
  ];

  const router = createMemoryRouter(routes, { initialEntries: ["/register"] });

  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );

  return router;
}

describe("RegisterPage", () => {
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

  it("renders all fields", async () => {
    renderRegisterRoute();

    expect(await screen.findByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /register/i })).toBeInTheDocument();
  });

  it("shows error when passwords do not match", async () => {
    renderRegisterRoute();
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: /register/i });

    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Email"), "newuser@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "mismatch");
    await user.click(screen.getByRole("button", { name: /register/i }));

    expect(await screen.findByText(/Passwords do not match./i)).toBeInTheDocument();
  });

  it("shows error when password is under 8 characters", async () => {
    renderRegisterRoute();
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: /register/i });

    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Email"), "newuser@example.com");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.type(screen.getByLabelText("Confirm Password"), "short");
    await user.click(screen.getByRole("button", { name: /register/i }));

    expect(await screen.findByText(/Password must be at least 8 characters long./i)).toBeInTheDocument();
  });

  it("submits successfully with valid data and redirects", async () => {
    // stub register and login
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/auth/refresh") && method === "POST") {
        return new Response(JSON.stringify({ message: "refresh required" }), { status: 401, headers: { "Content-Type": "application/json" } });
      }

      if (url.endsWith("/api/auth/register") && method === "POST") {
        return new Response(JSON.stringify({ success: true, user: { id: `newuser-id`, username: `newuser`, email: `newuser@example.com`, role: "user", permissions: [] } }), { status: 201, headers: { "Content-Type": "application/json" } });
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

    renderRegisterRoute();
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: /register/i });

    await user.type(screen.getByLabelText("Username"), "newuser");
    await user.type(screen.getByLabelText("Email"), "newuser@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: /register/i }));

    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
  });
});
