import { Link, useLocation } from "react-router";
import { useEffect } from "react";
import { LogOut, Palette } from "lucide-react";
import { useArtworks } from "../context/ArtworksContext";
import { trackPageVisit } from "../monitoring/activityMonitor";
import { FakeDataControl } from "./FakeDataControl";
import { useOptionalAuth } from "../../context/AuthContext";
import { AuthStatusPill } from "../../components/AuthStatusPill";
import { useNavigate } from "react-router";

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { syncStatus } = useArtworks();
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const logout = auth?.logout ?? (async () => {});
  const isReady = auth?.isReady ?? true;
  const isAdmin = auth?.isAdmin ?? false;

  useEffect(() => {
    trackPageVisit(location.pathname);
  }, [location.pathname]);
  
  const isActive = (path: string) => location.pathname === path;
  const showSyncBanner = syncStatus.mode !== "online";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };
  
  return (
    <nav className="glass-nav sticky top-0 z-40 border-b border-gray-200/80">
      {showSyncBanner && (
        <div className={`border-b px-4 py-2 text-sm sm:px-6 lg:px-8 ${syncStatus.mode === "syncing" ? "bg-[#FBF3DC] text-[#6B5210]" : "bg-[#FEE2E2] text-[#991B1B]"}`}>
          <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-3">
            <span>
              {syncStatus.mode === "syncing"
                ? `Syncing ${syncStatus.pendingOperations} pending change${syncStatus.pendingOperations === 1 ? "" : "s"} with the server.`
                : "Offline mode is active. Changes are saved locally and will sync when the server is reachable."}
            </span>
            {syncStatus.lastError && syncStatus.mode === "offline" && (
              <span className="hidden md:inline">{syncStatus.lastError}</span>
            )}
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-2 motion-button">
          <Palette className="h-7 w-7 text-[#D4AF37] sm:h-8 sm:w-8" />
          <span className="text-xl text-[#2C2C2C] sm:text-2xl">ArtSpace Gallery</span>
        </Link>
        
        <div className="flex w-full items-center justify-end gap-4 sm:w-auto sm:gap-8">
          <Link
            to="/"
            className={`text-sm transition-colors sm:text-base ${
              isActive("/") ? "font-medium text-[#D4AF37]" : "text-[#2C2C2C]"
            }`}
          >
            Home
          </Link>
          <Link
            to="/gallery"
            className={`text-sm transition-colors sm:text-base ${
              isActive("/gallery") ? "font-medium text-[#D4AF37]" : "text-[#2C2C2C]"
            }`}
          >
            Gallery
          </Link>
          <div className="h-6 w-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${
              syncStatus.mode === "syncing" 
                ? "bg-amber-500 animate-pulse" 
                : syncStatus.mode === "offline" 
                ? "bg-red-500" 
                : "bg-green-500"
            }`} />
            <span className="text-xs uppercase font-medium tracking-wide hidden sm:inline" title={syncStatus.lastError || undefined}>
              {syncStatus.mode === "syncing" && "Syncing..."}
              {syncStatus.mode === "offline" && "Offline"}
              {syncStatus.mode === "online" && "Online"}
            </span>
          </div>
          <div className="h-6 w-px bg-gray-300" />
          {isAdmin && <FakeDataControl batchSize={3} intervalMs={5000} />}
          {isReady && user ? (
            <>
              <AuthStatusPill username={user.username} role={isAdmin ? "admin" : user.role} />
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-md bg-[#2C2C2C] px-4 py-2 text-sm text-white transition-all hover:opacity-90 sm:px-6 sm:text-base"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className={`rounded-md px-4 py-2 text-sm text-white transition-all sm:px-6 sm:text-base motion-button ${
                isActive("/login") ? "bg-[#2C2C2C]" : "bg-[#D4AF37]"
              }`}
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}