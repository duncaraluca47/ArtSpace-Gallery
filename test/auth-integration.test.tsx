/// <reference types="vitest/globals" />

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useNavigate, type RouteObject, RouterProvider, createMemoryRouter } from "react-router";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { RequireAuth } from "../src/components/AuthGuards";
import { LoginPage } from "../src/components/LoginPage";
import { RegisterPage } from "../src/components/RegisterPage";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";

function createAccessToken(username: string) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      id: `${username}-id`,
      username,
      email: `${username}@example.com`,
      role: "user",
      permissions: [],
      tokenType: "access",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    }),
  );

  return `${header}.${payload}.signature`;
}

function ProtectedPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <main>
      <h1>Protected Dashboard</h1>
      <p>{user?.username}</p>
      <button
        type="button"
        onClick={async () => {
          await logout();
          navigate("/login");
        }}
      >
        Logout
      </button>
    </main>
  );
}

function renderAuthRoutes(initialEntry: string) {
  const routes: RouteObject[] = [
    { path: "/login", Component: LoginPage },
    { path: "/register", Component: RegisterPage },
    {
      path: "/",
      element: (
        <RequireAuth>
          <ProtectedPage />
        </RequireAuth>
      ),
    },
  ];

  const router = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
  });

  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );

  return router;
}

describe("auth integration flows", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/auth/refresh") && method === "POST") {
        return new Response(JSON.stringify({ message: "refresh required" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/auth/register") && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { username: string; email: string };
        return new Response(
          JSON.stringify({
            success: true,
            user: {
              id: `${body.username}-id`,
              username: body.username,
              email: body.email,
              role: "user",
              permissions: [],
            },
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.endsWith("/api/auth/login") && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { username: string };
        const accessToken = createAccessToken(body.username);

        return new Response(
          JSON.stringify({
            success: true,
            accessToken,
            user: {
              id: `${body.username}-id`,
              username: body.username,
              email: `${body.username}@example.com`,
              role: "user",
              permissions: [],
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

      return new Response(JSON.stringify({ message: "Unexpected request" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("registers, logs in, reaches a protected route, logs out, and gets redirected back to login", async () => {
    const user = userEvent.setup();
    renderAuthRoutes("/register");

    await screen.findByRole("heading", { name: "Register" });

    await user.type(screen.getByLabelText("Username"), "newmember");
    await user.type(screen.getByLabelText("Email"), "newmember@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByRole("heading", { name: "Protected Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("newmember")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    });
  });
});
