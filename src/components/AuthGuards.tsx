import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../context/AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isReady } = useAuth();

  if (!isReady) {
    return <div className="min-h-screen bg-white px-6 py-16 text-center text-[#2C2C2C]">Restoring your session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function RequirePermission({
  permission,
  children,
  fallback = "/",
}: {
  permission: string;
  children: ReactNode;
  fallback?: string;
}) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}