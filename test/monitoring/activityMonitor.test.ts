/// <reference types="vitest/globals" />

import {
  getActivitySnapshot,
  getGalleryPreference,
  setGalleryPreference,
  trackAction,
  trackPageVisit,
} from "../../src/app/monitoring/activityMonitor";

describe("activityMonitor", () => {
  beforeEach(() => {
    document.cookie = "artspace_activity=; path=/; max-age=0";
    document.cookie = "artspace_preferences=; path=/; max-age=0";
  });

  it("tracks page visits and actions in cookies", () => {
    trackPageVisit("/gallery");
    trackPageVisit("/gallery");
    trackAction("login_attempt");

    const snapshot = getActivitySnapshot();
    expect(snapshot.routeVisits["/gallery"]).toBe(2);
    expect(snapshot.actions.login_attempt).toBe(1);
    expect(snapshot.lastVisitedAt).toBeTruthy();
  });

  it("stores and reads gallery preferences", () => {
    setGalleryPreference({
      viewMode: "list",
      sort: "likes-desc",
      searchTerm: "Sarah",
    });

    const pref = getGalleryPreference();
    expect(pref.galleryViewMode).toBe("list");
    expect(pref.gallerySort).toBe("likes-desc");
    expect(pref.gallerySearchTerm).toBe("Sarah");
    expect(pref.updatedAt).toBeTruthy();
  });

  it("falls back to defaults when cookie parsing fails", () => {
    document.cookie = "artspace_preferences=%7B%7D; path=/";
    document.cookie = "artspace_activity=%7B%7D; path=/";

    const originalParse = JSON.parse;
    JSON.parse = (() => {
      throw new Error("parse failure");
    }) as typeof JSON.parse;

    try {
      const pref = getGalleryPreference();
      const snapshot = getActivitySnapshot();

      expect(pref.galleryViewMode).toBe("grid");
      expect(pref.gallerySort).toBe("newest-first");
      expect(pref.gallerySearchTerm).toBe("");
      expect(snapshot.routeVisits).toEqual({});
      expect(snapshot.actions).toEqual({});
      expect(snapshot.lastVisitedPath).toBe("/");
    } finally {
      JSON.parse = originalParse;
    }
  });

  it("ignores malformed cookie fragments while parsing", () => {
    document.cookie = "artspace_activity=%7B%22routeVisits%22%3A%7B%22%2Fgallery%22%3A1%7D%7D; path=/";
    const originalCookieDescriptor = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "cookie",
    );

    try {
      Object.defineProperty(document, "cookie", {
        configurable: true,
        get: () => "broken_cookie_fragment; artspace_activity=%7B%22routeVisits%22%3A%7B%22%2Fgallery%22%3A1%7D%7D",
        set: () => true,
      });

      const snapshot = getActivitySnapshot();
      expect(snapshot.routeVisits["/gallery"]).toBe(1);
    } finally {
      if (originalCookieDescriptor) {
        Object.defineProperty(document, "cookie", originalCookieDescriptor);
      }
    }
  });

  it("keeps existing values when preference input is partial", () => {
    setGalleryPreference({ viewMode: "stats", sort: "reviews-desc", searchTerm: "portrait" });
    setGalleryPreference({ searchTerm: "" });

    const pref = getGalleryPreference();
    expect(pref.galleryViewMode).toBe("stats");
    expect(pref.gallerySort).toBe("reviews-desc");
    expect(pref.gallerySearchTerm).toBe("");
  });
});
