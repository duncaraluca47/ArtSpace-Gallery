type ActivityAction =
  | "login_attempt"
  | "login_success"
  | "register_attempt"
  | "register_success"
  | "artwork_created"
  | "artwork_updated"
  | "artwork_deleted"
  | "gallery_search_applied"
  | "gallery_filters_cleared"
  | "gallery_surprise_opened"
  | "artwork_like_toggled";

type GalleryViewMode = "grid" | "list" | "stats" | "split";

type SortOption =
  | "newest-first"
  | "price-asc"
  | "price-desc"
  | "year-asc"
  | "year-desc"
  | "likes-asc"
  | "likes-desc"
  | "reviews-asc"
  | "reviews-desc"
  | "rating-asc"
  | "rating-desc";

type ActivityState = {
  routeVisits: Record<string, number>;
  actions: Partial<Record<ActivityAction, number>>;
  lastVisitedPath: string;
  lastVisitedAt: string;
};

type PreferenceState = {
  galleryViewMode: GalleryViewMode;
  gallerySort: SortOption;
  gallerySearchTerm: string;
  updatedAt: string;
};

const ACTIVITY_COOKIE = "artspace_activity";
const PREFERENCES_COOKIE = "artspace_preferences";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function createDefaultActivityState(): ActivityState {
  return {
    routeVisits: {},
    actions: {},
    lastVisitedPath: "/",
    lastVisitedAt: "",
  };
}

function createDefaultPreferenceState(): PreferenceState {
  return {
    galleryViewMode: "grid",
    gallerySort: "newest-first",
    gallerySearchTerm: "",
    updatedAt: "",
  };
}

function parseCookie(name: string): string | null {
  const encodedName = encodeURIComponent(name);
  const parts = document.cookie ? document.cookie.split("; ") : [];

  for (const part of parts) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = part.slice(0, separatorIndex);
    if (key !== encodedName) {
      continue;
    }

    const value = part.slice(separatorIndex + 1);
    return decodeURIComponent(value);
  }

  return null;
}

function writeCookie(name: string, payload: unknown) {
  const value = encodeURIComponent(JSON.stringify(payload));
  const encodedName = encodeURIComponent(name);
  document.cookie = `${encodedName}=${value}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

function readCookieState<T>(name: string, fallback: T): T {
  try {
    const raw = parseCookie(name);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as T;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function trackPageVisit(pathname: string) {
  const state = readCookieState(ACTIVITY_COOKIE, createDefaultActivityState());
  const visits = state.routeVisits[pathname] ?? 0;

  state.routeVisits[pathname] = visits + 1;
  state.lastVisitedPath = pathname;
  state.lastVisitedAt = new Date().toISOString();

  writeCookie(ACTIVITY_COOKIE, state);
}

export function trackAction(action: ActivityAction) {
  const state = readCookieState(ACTIVITY_COOKIE, createDefaultActivityState());
  const count = state.actions[action] ?? 0;

  state.actions[action] = count + 1;
  state.lastVisitedAt = new Date().toISOString();

  writeCookie(ACTIVITY_COOKIE, state);
}

export function setGalleryPreference(input: {
  viewMode?: GalleryViewMode;
  sort?: SortOption;
  searchTerm?: string;
}) {
  const state = readCookieState(PREFERENCES_COOKIE, createDefaultPreferenceState());

  if (input.viewMode) {
    state.galleryViewMode = input.viewMode;
  }

  if (input.sort) {
    state.gallerySort = input.sort;
  }

  if (typeof input.searchTerm === "string") {
    state.gallerySearchTerm = input.searchTerm;
  }

  state.updatedAt = new Date().toISOString();
  writeCookie(PREFERENCES_COOKIE, state);
}

export function getGalleryPreference(): PreferenceState {
  return readCookieState(PREFERENCES_COOKIE, createDefaultPreferenceState());
}

export function getActivitySnapshot(): ActivityState {
  return readCookieState(ACTIVITY_COOKIE, createDefaultActivityState());
}
