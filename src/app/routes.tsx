import { createBrowserRouter } from "react-router";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "../components/LoginPage";
import { ForgotPasswordPage } from "../components/ForgotPasswordPage";
import { RegisterPage } from "../components/RegisterPage";
import { ResetPasswordPage } from "../components/ResetPasswordPage";
import { GalleryPage } from "./pages/GalleryPage";
import { ArtworkDetailPage } from "./pages/ArtworkDetailPage";
import { AddArtworkPage } from "./pages/AddArtworkPage";
import { EditArtworkPage } from "./pages/EditArtworkPage";
import { RequireAuth, RequirePermission } from "../components/AuthGuards";

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <RequireAuth>
        <LandingPage />
      </RequireAuth>
    ),
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/gallery",
    element: (
      <RequireAuth>
        <GalleryPage />
      </RequireAuth>
    ),
  },
  {
    path: "/artwork/:id",
    element: (
      <RequireAuth>
        <ArtworkDetailPage />
      </RequireAuth>
    ),
  },
  {
    path: "/add-artwork",
    element: (
      <RequireAuth>
        <RequirePermission permission="artwork:create">
          <AddArtworkPage />
        </RequirePermission>
      </RequireAuth>
    ),
  },
  {
    path: "/edit-artwork/:id",
    element: (
      <RequireAuth>
        <RequirePermission permission="artwork:edit">
          <EditArtworkPage />
        </RequirePermission>
      </RequireAuth>
    ),
  },
]);