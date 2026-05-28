import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  DollarSign,
  Edit,
  Eye,
  Filter,
  Grid3x3,
  Heart,
  List,
  PanelsTopLeft,
  Plus,
  Search,
  Shuffle,
  Star as StarIcon,
  ThumbsUp,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Navigation } from "../components/Navigation";
import { useOptionalAuth } from "../../context/AuthContext";
import { StarRating } from "../components/StarRating";
import { DualRangeSlider } from "../components/DualRangeSlider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import type { Artwork } from "../data/artworks";
import { useArtworks } from "../context/ArtworksContext";
import {
  getGalleryPreference,
  setGalleryPreference,
  trackAction,
} from "../monitoring/activityMonitor";
import {
  fetchArtworkPage,
  type ArtworkPageResponse,
} from "../services/artworkPagination";
import {
  filterArtworks,
  getAverageRating,
  sortArtworks,
  type SortOption,
  type ViewMode,
} from "./galleryLogic";
import {
  toArtworkDraft,
  validateArtworkForm,
  type ArtworkFormValues,
} from "../validation/forms";
import {
  addTemporarySplitArtwork,
  removeTemporarySplitArtwork,
  updateTemporarySplitArtwork,
} from "./splitCrud";
import {
  buildArtistData,
  buildLikesData,
  buildPriceRanges,
  buildRatingData,
  buildScatterData,
  buildYearData,
  summarizeArtworks,
} from "./galleryStats";

const CHART_COLORS = ["#D4AF37", "#2C2C2C", "#627d9a", "#DC2626", "#666666", "#9CA3AF"];
const BROWSE_PAGE_SIZE = 6;

function mergeArtworksById(primary: Artwork[], secondary: Artwork[]) {
  const next = new Map<string, Artwork>();

  for (const artwork of secondary) {
    next.set(artwork.id, artwork);
  }

  for (const artwork of primary) {
    next.set(artwork.id, artwork);
  }

  return Array.from(next.values());
}

function hydrateArtworkForBrowse(artwork: Artwork, sourceArtworks: Artwork[]) {
  const sourceArtwork = sourceArtworks.find((candidate) => candidate.id === artwork.id);

  if (!sourceArtwork) {
    return {
      ...artwork,
      likes: 0,
      reviews: [],
    };
  }

  return {
    ...artwork,
    likes: sourceArtwork.likes,
    reviews: sourceArtwork.reviews,
  };
}

function hydrateArtworkPageForBrowse(items: Artwork[], sourceArtworks: Artwork[]) {
  return items.map((artwork) => hydrateArtworkForBrowse(artwork, sourceArtworks));
}

export function GalleryPage() {
  const { artworks } = useArtworks();
  const auth = useOptionalAuth();
  const hasPermission = auth?.hasPermission ?? (() => false);
  const isAdmin = auth?.isAdmin ?? false;
  const preferences = getGalleryPreference();

  const [viewMode, setViewMode] = useState<ViewMode>(preferences.galleryViewMode);
  const [likedArtworks, setLikedArtworks] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showSurprise, setShowSurprise] = useState(false);
  const [surpriseArtwork, setSurpriseArtwork] = useState<Artwork | null>(null);
  const [isFadingIn, setIsFadingIn] = useState(false);

  const [appliedSortBy, setAppliedSortBy] = useState<SortOption>(preferences.gallerySort);
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [appliedMinRating, setAppliedMinRating] = useState(0);
  const [appliedMinPrice, setAppliedMinPrice] = useState(0);
  const [appliedMaxPrice, setAppliedMaxPrice] = useState(100000);

  const [tempSortBy, setTempSortBy] = useState<SortOption>(preferences.gallerySort);
  const [tempSearchTerm, setTempSearchTerm] = useState(preferences.gallerySearchTerm);
  const [tempMinRating, setTempMinRating] = useState(0);
  const [tempMinPrice, setTempMinPrice] = useState(0);
  const [tempMaxPrice, setTempMaxPrice] = useState(100000);

  const [statsChartType, setStatsChartType] = useState<"price" | "artist" | "rating" | "year" | "likes">("price");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editingArtworkId, setEditingArtworkId] = useState<string | null>(null);
  const [quickAddValues, setQuickAddValues] = useState<ArtworkFormValues>({
    title: "",
    artist: "",
    year: "",
    price: "",
    category: "",
    description: "",
    imageUrl: "",
  });
  const [editValues, setEditValues] = useState<ArtworkFormValues>({
    title: "",
    artist: "",
    year: "",
    price: "",
    category: "",
    description: "",
    imageUrl: "",
  });
  const [quickAddErrors, setQuickAddErrors] = useState<Partial<Record<keyof ArtworkFormValues, string>>>({});
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof ArtworkFormValues, string>>>({});
  const [splitDraftArtworks, setSplitDraftArtworks] = useState<Artwork[] | null>(null);
  const canCreateArtwork = hasPermission("artwork:create");
  const canEditArtwork = hasPermission("artwork:edit");
  const canDeleteArtwork = hasPermission("artwork:delete");

  const [browseArtworks, setBrowseArtworks] = useState<Artwork[]>([]);
  const [isInitialBrowseLoading, setIsInitialBrowseLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [hasMoreBrowsePages, setHasMoreBrowsePages] = useState(true);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [realtimeOverlayArtworks, setRealtimeOverlayArtworks] = useState<Artwork[]>([]);
  const browseSentinelRef = useRef<HTMLDivElement | null>(null);
  const browseCacheRef = useRef(new Map<string, ArtworkPageResponse>());
  const inFlightPagesRef = useRef(new Map<string, Promise<ArtworkPageResponse>>());
  const loadedPageNumbersRef = useRef(new Set<number>());
  const nextPageToLoadRef = useRef(1);
  const artworksRef = useRef(artworks);
  const previousArtworkIdsRef = useRef<Set<string>>(new Set(artworks.map((artwork) => artwork.id)));

  useEffect(() => {
    artworksRef.current = artworks;
  }, [artworks]);

  useEffect(() => {
    if (!isAdmin && (viewMode === "stats" || viewMode === "split")) {
      setViewMode("grid");
    }
  }, [isAdmin, viewMode]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseSurprise();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  });

  const toggleLike = (artworkId: string) => {
    trackAction("artwork_like_toggled");
    setLikedArtworks((prev) => {
      const next = new Set(prev);
      if (next.has(artworkId)) {
        next.delete(artworkId);
      } else {
        next.add(artworkId);
      }
      return next;
    });
  };

  const handleSurpriseMe = () => {
    if (artworks.length === 0) {
      return;
    }

    trackAction("gallery_surprise_opened");

    const randomArtwork = artworks[Math.floor(Math.random() * artworks.length)];
    setSurpriseArtwork(randomArtwork);
    setShowSurprise(true);
    setTimeout(() => setIsFadingIn(true), 20);
  };

  const handleCloseSurprise = () => {
    setIsFadingIn(false);
    setTimeout(() => {
      setShowSurprise(false);
      setSurpriseArtwork(null);
    }, 250);
  };

  const filteredArtworks = useMemo(() => {
    return filterArtworks(
      artworks,
      appliedSearchTerm,
      appliedMinRating,
      appliedMinPrice,
      appliedMaxPrice,
    );
  }, [artworks, appliedSearchTerm, appliedMinRating, appliedMinPrice, appliedMaxPrice]);

  const sortedArtworks = useMemo(() => {
    return sortArtworks(filteredArtworks, appliedSortBy);
  }, [filteredArtworks, appliedSortBy]);

  const browseQuery = useMemo(
    () => ({
      search: appliedSearchTerm.trim() || undefined,
    }),
    [appliedSearchTerm],
  );

  useEffect(() => {
    const currentIds = new Set(artworks.map((artwork) => artwork.id));
    const previousIds = previousArtworkIdsRef.current;

    setRealtimeOverlayArtworks((current) => {
      const next = new Map(current.map((artwork) => [artwork.id, artwork]));

      for (const artwork of artworks) {
        if (!previousIds.has(artwork.id)) {
          next.set(artwork.id, artwork);
        } else if (next.has(artwork.id)) {
          next.set(artwork.id, artwork);
        }
      }

      for (const artworkId of Array.from(next.keys())) {
        if (!currentIds.has(artworkId)) {
          next.delete(artworkId);
        }
      }

      return Array.from(next.values());
    });

    previousArtworkIdsRef.current = currentIds;
  }, [artworks]);

  useEffect(() => {
    let cancelled = false;

    browseCacheRef.current.clear();
    inFlightPagesRef.current.clear();
    loadedPageNumbersRef.current.clear();
    nextPageToLoadRef.current = 1;
    setBrowseArtworks([]);
    setHasMoreBrowsePages(true);
    setBrowseError(null);
    setIsInitialBrowseLoading(true);
    setIsFetchingNextPage(false);

    const loadPage = async (page: number, prefetch = false) => {
      const cacheKey = `${browseQuery.search ?? ""}:${page}`;
      const cached = browseCacheRef.current.get(cacheKey);

      if (cached) {
        if (!prefetch && !loadedPageNumbersRef.current.has(page) && !cancelled) {
          loadedPageNumbersRef.current.add(page);
          nextPageToLoadRef.current = page + 1;
          setBrowseArtworks((current) =>
            page === 1 ? cached.items : mergeArtworksById(current, cached.items),
          );
          setHasMoreBrowsePages(page < cached.pagination.totalPages);
          setIsInitialBrowseLoading(false);
        }

        if (prefetch && page < cached.pagination.totalPages) {
          void loadPage(page + 1, true);
        }

        return cached;
      }

      const inFlight = inFlightPagesRef.current.get(cacheKey);
      if (inFlight) {
        return inFlight;
      }

      const request = fetchArtworkPage({
        page,
        pageSize: BROWSE_PAGE_SIZE,
        search: browseQuery.search,
      });

      inFlightPagesRef.current.set(cacheKey, request);

      try {
        const response = await request;

        if (cancelled) {
          return response;
        }

        const hydratedResponse = {
          ...response,
          items: hydrateArtworkPageForBrowse(response.items, artworksRef.current),
        };

        browseCacheRef.current.set(cacheKey, hydratedResponse);

        if (!prefetch && !loadedPageNumbersRef.current.has(page)) {
          loadedPageNumbersRef.current.add(page);
          nextPageToLoadRef.current = page + 1;
          setBrowseArtworks((current) =>
            page === 1 ? hydratedResponse.items : mergeArtworksById(current, hydratedResponse.items),
          );
          setHasMoreBrowsePages(page < hydratedResponse.pagination.totalPages);
          setBrowseError(null);
          setIsInitialBrowseLoading(false);

          if (page < hydratedResponse.pagination.totalPages) {
            void loadPage(page + 1, true);
          }
        } else if (prefetch && page < hydratedResponse.pagination.totalPages) {
          void loadPage(page + 1, true);
        }

        return hydratedResponse;
      } catch (error) {
        if (!cancelled && !prefetch) {
          setBrowseError(error instanceof Error ? error.message : "Failed to load artworks.");
          setIsInitialBrowseLoading(false);
        }

        throw error;
      } finally {
        inFlightPagesRef.current.delete(cacheKey);
      }
    };

    void loadPage(1).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [browseQuery.search]);

  useEffect(() => {
    if (viewMode === "stats" || viewMode === "split") {
      return;
    }

    const sentinel = browseSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMoreBrowseArtworks();
      }
    }, {
      rootMargin: "600px 0px 600px 0px",
      threshold: 0.1,
    });

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [viewMode, hasMoreBrowsePages, isFetchingNextPage, isInitialBrowseLoading, browseArtworks.length]);

  function loadMoreBrowseArtworks() {
    if (!hasMoreBrowsePages || isInitialBrowseLoading || isFetchingNextPage) {
      return;
    }

    setIsFetchingNextPage(true);
    const nextPage = nextPageToLoadRef.current;

    const cacheKey = `${browseQuery.search ?? ""}:${nextPage}`;
    const cached = browseCacheRef.current.get(cacheKey);

    const complete = () => setIsFetchingNextPage(false);

    if (cached) {
      if (!loadedPageNumbersRef.current.has(nextPage)) {
        loadedPageNumbersRef.current.add(nextPage);
        nextPageToLoadRef.current = nextPage + 1;
        setBrowseArtworks((current) => mergeArtworksById(current, cached.items));
        setHasMoreBrowsePages(nextPage < cached.pagination.totalPages);
      }

      if (nextPage < cached.pagination.totalPages) {
        void fetchArtworkPage({
          page: nextPage + 1,
          pageSize: BROWSE_PAGE_SIZE,
          search: browseQuery.search,
        }).then((response) => {
          browseCacheRef.current.set(
            `${browseQuery.search ?? ""}:${nextPage + 1}`,
            {
              ...response,
              items: hydrateArtworkPageForBrowse(response.items, artworksRef.current),
            },
          );
        }).catch(() => undefined);
      }

      complete();
      return;
    }

    void fetchArtworkPage({
      page: nextPage,
      pageSize: BROWSE_PAGE_SIZE,
      search: browseQuery.search,
    })
      .then((response) => {
        const hydratedResponse = {
          ...response,
          items: hydrateArtworkPageForBrowse(response.items, artworksRef.current),
        };

        browseCacheRef.current.set(cacheKey, hydratedResponse);
        if (!loadedPageNumbersRef.current.has(nextPage)) {
          loadedPageNumbersRef.current.add(nextPage);
          nextPageToLoadRef.current = nextPage + 1;
          setBrowseArtworks((current) => mergeArtworksById(current, hydratedResponse.items));
          setHasMoreBrowsePages(nextPage < response.pagination.totalPages);
        }

        if (nextPage < response.pagination.totalPages) {
          void fetchArtworkPage({
            page: nextPage + 1,
            pageSize: BROWSE_PAGE_SIZE,
            search: browseQuery.search,
          }).then((prefetched) => {
            browseCacheRef.current.set(
              `${browseQuery.search ?? ""}:${nextPage + 1}`,
              {
                ...prefetched,
                items: hydrateArtworkPageForBrowse(prefetched.items, artworksRef.current),
              },
            );
          }).catch(() => undefined);
        }
      })
      .catch((error) => {
        setBrowseError(error instanceof Error ? error.message : "Failed to load artworks.");
      })
      .finally(complete);
  }

  const browseArtworksForDisplay = useMemo(() => {
    const source = mergeArtworksById(realtimeOverlayArtworks, browseArtworks);
    const artworkById = new Map(artworks.map((artwork) => [artwork.id, artwork]));

    // Reconcile paged cache with authoritative context so deletes are reflected immediately.
    const reconciled = source
      .filter((artwork) => artworkById.has(artwork.id))
      .map((artwork) => hydrateArtworkForBrowse(artworkById.get(artwork.id) ?? artwork, artworks));

    const reconciledIds = new Set(reconciled.map((artwork) => artwork.id));
    // Include client-created entries that may not be in the current server page yet.
    const localNewArtworks = artworks.filter(
      (artwork) => !reconciledIds.has(artwork.id) && artwork.id.includes("-"),
    );

    const filtered = filterArtworks(
      [...reconciled, ...localNewArtworks],
      appliedSearchTerm,
      appliedMinRating,
      appliedMinPrice,
      appliedMaxPrice,
    );

    if (appliedSortBy !== "newest-first") {
      return sortArtworks(filtered, appliedSortBy);
    }

    // In browse mode, use context insertion order as source of truth for newest-first.
    const newestPositions = new Map(artworks.map((artwork, index) => [artwork.id, index]));
    return [...filtered].sort(
      (a, b) => (newestPositions.get(b.id) ?? -1) - (newestPositions.get(a.id) ?? -1),
    );
  }, [browseArtworks, realtimeOverlayArtworks, artworks, appliedSearchTerm, appliedMinRating, appliedMinPrice, appliedMaxPrice, appliedSortBy]);

  const splitArtworks = splitDraftArtworks ?? sortedArtworks;
  const statsSourceArtworks = viewMode === "split" ? splitArtworks : artworks;

  const handleApplyFilters = () => {
    setAppliedSortBy(tempSortBy);
    setAppliedSearchTerm(tempSearchTerm);
    setAppliedMinRating(tempMinRating);
    setAppliedMinPrice(tempMinPrice);
    setAppliedMaxPrice(tempMaxPrice);
    setGalleryPreference({
      sort: tempSortBy,
      searchTerm: tempSearchTerm,
      viewMode,
    });
    trackAction("gallery_search_applied");
    if (viewMode === "split") {
      setSplitDraftArtworks(null);
    }
    setShowFilters(false);
  };

  const handleRemoveFilters = () => {
    setTempSortBy("newest-first");
    setTempSearchTerm("");
    setTempMinRating(0);
    setTempMinPrice(0);
    setTempMaxPrice(100000);

    setAppliedSortBy("newest-first");
    setAppliedSearchTerm("");
    setAppliedMinRating(0);
    setAppliedMinPrice(0);
    setAppliedMaxPrice(100000);
    setGalleryPreference({
      sort: "newest-first",
      searchTerm: "",
      viewMode,
    });
    trackAction("gallery_filters_cleared");
    if (viewMode === "split") {
      setSplitDraftArtworks(null);
    }
  };

  const handleQuickAddChange =
    (field: keyof ArtworkFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setQuickAddValues((current) => ({ ...current, [field]: value }));
      setQuickAddErrors((current) => ({ ...current, [field]: undefined }));
    };

  const handleEditChange =
    (field: keyof ArtworkFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setEditValues((current) => ({ ...current, [field]: value }));
      setEditErrors((current) => ({ ...current, [field]: undefined }));
    };

  const resetArtworkFormValues: ArtworkFormValues = {
    title: "",
    artist: "",
    year: "",
    price: "",
    category: "",
    description: "",
    imageUrl: "",
  };

  const handleQuickAddSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const validationErrors = validateArtworkForm(quickAddValues);
    if (Object.keys(validationErrors).length > 0) {
      setQuickAddErrors(validationErrors);
      return;
    }

    const draft = toArtworkDraft(quickAddValues);
    setSplitDraftArtworks((current) => addTemporarySplitArtwork(current, sortedArtworks, draft));
    trackAction("artwork_created");
    setQuickAddValues(resetArtworkFormValues);
    setQuickAddErrors({});
    setShowQuickAdd(false);
  };

  const startInlineEdit = (artwork: Artwork) => {
    setEditingArtworkId(artwork.id);
    setEditValues({
      title: artwork.title,
      artist: artwork.artist,
      year: String(artwork.year),
      price: String(artwork.price),
      category: artwork.category,
      description: artwork.description,
      imageUrl: artwork.imageUrl,
    });
    setEditErrors({});
  };

  const cancelInlineEdit = () => {
    setEditingArtworkId(null);
    setEditErrors({});
    setEditValues(resetArtworkFormValues);
  };

  const saveInlineEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingArtworkId) {
      return;
    }

    const validationErrors = validateArtworkForm(editValues);
    if (Object.keys(validationErrors).length > 0) {
      setEditErrors(validationErrors);
      return;
    }

    const draft = toArtworkDraft(editValues);
    setSplitDraftArtworks((current) => updateTemporarySplitArtwork(current, sortedArtworks, editingArtworkId, draft));
    trackAction("artwork_updated");
    cancelInlineEdit();
  };

  const deleteInlineArtwork = (artwork: Artwork) => {
    const confirmed = window.confirm(`Delete \"${artwork.title}\" from the gallery?`);
    if (!confirmed) {
      return;
    }

    setSplitDraftArtworks((current) => removeTemporarySplitArtwork(current, sortedArtworks, artwork.id));
    trackAction("artwork_deleted");
  };

  useEffect(() => {
    setGalleryPreference({ viewMode });
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === "split") {
      setSplitDraftArtworks((current) => current ?? sortedArtworks);
      return;
    }

    setSplitDraftArtworks(null);
    setShowQuickAdd(false);
    setEditingArtworkId(null);
  }, [viewMode, sortedArtworks]);

  const priceRanges = buildPriceRanges(statsSourceArtworks);
  const artistData = buildArtistData(statsSourceArtworks);
  const ratingData = buildRatingData(statsSourceArtworks);
  const yearData = buildYearData(statsSourceArtworks);
  const likesData = buildLikesData(statsSourceArtworks);
  const scatterData = buildScatterData(statsSourceArtworks);
  const {
    totalArtworks,
    averagePrice,
    averageRating,
    totalLikes,
    uniqueArtists,
    maxPrice,
    minPrice,
  } = summarizeArtworks(statsSourceArtworks);

  return (
    <div className="gallery-page-bg min-h-screen page-reveal">
      <Navigation />

      {showSurprise && surpriseArtwork && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${isFadingIn ? "bg-black/95 backdrop-blur-md" : "bg-black/0 backdrop-blur-0"}`}
          onClick={handleCloseSurprise}
        >
          <div
            className={`relative w-full max-w-4xl transform transition-all duration-500 ${isFadingIn ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button onClick={handleCloseSurprise} title="Close" aria-label="Close" className="absolute -top-12 right-0 text-white hover:text-gray-300">
              <XCircle className="h-8 w-8" />
            </button>

            <div className="overflow-hidden rounded-lg shadow-2xl bg-black">
              <img src={surpriseArtwork.imageUrl} alt={surpriseArtwork.title} className="h-auto max-h-[70vh] w-full object-contain" />
              <div className="bg-gradient-to-t from-black via-black/70 to-transparent p-8">
                <h2 className="mb-2 text-4xl font-bold text-white md:text-5xl">{surpriseArtwork.title}</h2>
                <p className="mb-2 text-xl text-gray-200 md:text-2xl">{surpriseArtwork.artist}, {surpriseArtwork.year}</p>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-2xl text-[#D4AF37]">${surpriseArtwork.price.toLocaleString()}</span>
                  <div className="flex items-center gap-2 text-gray-300">
                    <StarRating rating={getAverageRating(surpriseArtwork)} size={20} />
                    <span>({surpriseArtwork.reviews.length} reviews)</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-300">
                    <Heart size={20} fill="#DC2626" stroke="#DC2626" />
                    <span>{surpriseArtwork.likes} likes</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <Link to={`/artwork/${surpriseArtwork.id}`} onClick={handleCloseSurprise} className="inline-flex items-center gap-2 rounded-md bg-[#D4AF37] px-6 py-3 text-white hover:opacity-90">
                <Eye className="h-5 w-5" />
                View Details
              </Link>
              <button onClick={() => toggleLike(surpriseArtwork.id)} className="inline-flex items-center gap-2 rounded-md bg-[#2C2C2C] px-6 py-3 text-white hover:opacity-90">
                <Heart size={20} fill={likedArtworks.has(surpriseArtwork.id) ? "#DC2626" : "none"} stroke={likedArtworks.has(surpriseArtwork.id) ? "#DC2626" : "white"} />
                {likedArtworks.has(surpriseArtwork.id) ? "Liked" : "Like"}
              </button>
              <button onClick={handleSurpriseMe} className="inline-flex items-center gap-2 rounded-md bg-[#627d9a] px-6 py-3 text-white hover:opacity-90">
                <Shuffle className="h-5 w-5" />
                Try Another
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center fade-up xl:flex-nowrap">
          <h1 className="text-3xl text-[#2C2C2C] sm:text-4xl xl:whitespace-nowrap">Artwork Gallery</h1>

          <div className="flex flex-wrap items-center gap-3 lg:gap-2 xl:flex-nowrap">
            {canCreateArtwork && viewMode !== "split" && viewMode !== "stats" && (
              <Link to="/add-artwork" className="motion-button inline-flex shrink-0 items-center gap-2 rounded-md bg-[#D4AF37] px-4 py-2.5 text-sm text-white hover:opacity-90 sm:px-6 sm:py-3 sm:text-base xl:whitespace-nowrap">
                <Plus className="h-5 w-5" />
                Add Artwork
              </Link>
            )}

            {viewMode !== "stats" && (
              <button onClick={() => setShowFilters((prev) => !prev)} className="motion-button inline-flex shrink-0 items-center gap-2 rounded-md bg-[#2C2C2C] px-4 py-2.5 text-sm text-white hover:opacity-90 sm:px-6 sm:py-3 sm:text-base">
                <Filter className="h-5 w-5" />
                {showFilters ? "Hide" : "Show"} Filters & Sort
              </button>
            )}

            <div className="flex shrink-0 items-center gap-2 rounded-md bg-gray-100 p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`inline-flex items-center gap-2 rounded px-4 py-2 ${viewMode === "grid" ? "bg-[#D4AF37] text-white" : "text-[#666666]"}`}
              >
                <Grid3x3 className="h-4 w-4" />
                Grid
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`inline-flex items-center gap-2 rounded px-4 py-2 ${viewMode === "list" ? "bg-[#D4AF37] text-white" : "text-[#666666]"}`}
              >
                <List className="h-4 w-4" />
                List
              </button>
              {isAdmin && (
                <>
                  <button
                    onClick={() => setViewMode("stats")}
                    className={`inline-flex items-center gap-2 rounded px-4 py-2 ${viewMode === "stats" ? "bg-[#D4AF37] text-white" : "text-[#666666]"}`}
                  >
                    <BarChart3 className="h-4 w-4" />
                    Stats
                  </button>
                  <button
                    onClick={() => setViewMode("split")}
                    className={`inline-flex items-center gap-2 rounded px-4 py-2 ${viewMode === "split" ? "bg-[#D4AF37] text-white" : "text-[#666666]"}`}
                  >
                    <PanelsTopLeft className="h-4 w-4" />
                    Split
                  </button>
                </>
              )}
            </div>

            <button onClick={handleSurpriseMe} className="motion-button inline-flex shrink-0 items-center gap-2 rounded-md bg-[#627d9a] px-4 py-2.5 text-sm text-white shadow hover:opacity-90 sm:px-6 sm:py-3 sm:text-base">
              <Shuffle className="h-5 w-5" />
              Surprise Me
            </button>
          </div>
        </div>

        {showFilters && viewMode !== "stats" && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white/95 p-6 backdrop-blur-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm text-[#2C2C2C]">
                  <Search className="mr-2 inline h-4 w-4" />
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Title, artist, category..."
                  value={tempSearchTerm}
                  onChange={(event) => setTempSearchTerm(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 text-[#2C2C2C]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-[#2C2C2C]">Minimum Rating</label>
                <select
                  title="Minimum Rating"
                  value={tempMinRating}
                  onChange={(event) => setTempMinRating(Number(event.target.value))}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 text-[#2C2C2C]"
                >
                  <option value={0}>All Ratings</option>
                  <option value={1}>1+ Stars</option>
                  <option value={2}>2+ Stars</option>
                  <option value={3}>3+ Stars</option>
                  <option value={4}>4+ Stars</option>
                  <option value={5}>5 Stars</option>
                </select>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="mb-2 block text-sm text-[#2C2C2C]">
                  Price Range: ${tempMinPrice.toLocaleString()} - ${tempMaxPrice.toLocaleString()}
                </label>
                <DualRangeSlider
                  min={0}
                  max={100000}
                  step={1000}
                  minValue={tempMinPrice}
                  maxValue={tempMaxPrice}
                  onChange={(min, max) => {
                    setTempMinPrice(min);
                    setTempMaxPrice(max);
                  }}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm text-[#2C2C2C]">Sort By</label>
              <select
                title="Sort By"
                value={tempSortBy}
                onChange={(event) => setTempSortBy(event.target.value as SortOption)}
                className="w-full rounded-md border border-gray-300 px-4 py-2 text-[#2C2C2C] md:w-auto"
              >
                <option value="newest-first">Newest Added First</option>
                <option value="year-desc">Year: Newest to Oldest</option>
                <option value="year-asc">Year: Oldest to Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="likes-asc">Likes: Low to High</option>
                <option value="likes-desc">Likes: High to Low</option>
                <option value="reviews-asc">Reviews: Fewest First</option>
                <option value="reviews-desc">Reviews: Most First</option>
                <option value="rating-asc">Rating: Low to High</option>
                <option value="rating-desc">Rating: High to Low</option>
              </select>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={handleApplyFilters} className="rounded-md bg-[#D4AF37] px-6 py-2 text-white">
                Apply Filters
              </button>
              <button onClick={handleRemoveFilters} className="inline-flex items-center gap-2 rounded-md bg-[#666666] px-6 py-2 text-white">
                <X className="h-4 w-4" />
                Remove Filters
              </button>
              <button onClick={() => setShowFilters(false)} className="rounded-md bg-[#2C2C2C] px-6 py-2 text-white">
                Cancel
              </button>
            </div>
          </div>
        )}

        {viewMode === "stats" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white/95 p-6 backdrop-blur-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[#666666]">Total Artworks</h3>
                  <BarChart3 className="h-5 w-5 text-[#D4AF37]" />
                </div>
                <p className="text-3xl font-bold text-[#2C2C2C]">{totalArtworks}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white/95 p-6 backdrop-blur-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[#666666]">Average Price</h3>
                  <DollarSign className="h-5 w-5 text-[#D4AF37]" />
                </div>
                <p className="text-3xl font-bold text-[#2C2C2C]">${averagePrice.toLocaleString()}</p>
                <p className="mt-1 text-sm text-[#666666]">Range: ${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white/95 p-6 backdrop-blur-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[#666666]">Average Rating</h3>
                  <StarIcon className="h-5 w-5 text-[#D4AF37]" />
                </div>
                <p className="text-3xl font-bold text-[#2C2C2C]">{averageRating.toFixed(1)} ?</p>
                <StarRating rating={averageRating} size={16} />
              </div>
              <div className="rounded-lg border border-gray-200 bg-white/95 p-6 backdrop-blur-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[#666666]">Artists & Likes</h3>
                  <Users className="h-5 w-5 text-[#D4AF37]" />
                </div>
                <p className="text-3xl font-bold text-[#2C2C2C]">{uniqueArtists}</p>
                <p className="mt-1 text-sm text-[#666666]">{totalLikes} total likes</p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white/95 p-4 backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: "price", label: "Price", icon: DollarSign },
                  { key: "artist", label: "Artists", icon: Users },
                  { key: "rating", label: "Ratings", icon: StarIcon },
                  { key: "year", label: "Years", icon: Calendar },
                  { key: "likes", label: "Likes", icon: ThumbsUp },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setStatsChartType(key as typeof statsChartType)}
                    className={`rounded-md px-4 py-2 text-sm ${
                      statsChartType === key ? "bg-[#D4AF37] text-white" : "border border-gray-200 text-[#666666]"
                    }`}
                  >
                    <Icon className="mr-2 inline h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white/95 p-6 backdrop-blur-sm">
              <h2 className="mb-6 text-xl font-semibold text-[#2C2C2C]">Statistics</h2>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  {statsChartType === "price" ? (
                    <BarChart data={priceRanges}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#D4AF37" name="Artworks" />
                    </BarChart>
                  ) : statsChartType === "artist" ? (
                    <BarChart data={artistData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#627d9a" name="Artworks" />
                    </BarChart>
                  ) : statsChartType === "rating" ? (
                    <BarChart data={ratingData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" name="Artworks">
                        {ratingData.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : statsChartType === "year" ? (
                    <BarChart data={yearData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#2C2C2C" name="Artworks" />
                    </BarChart>
                  ) : (
                    <BarChart data={likesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#DC2626" name="Artworks" />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {(statsChartType === "price" || statsChartType === "likes") && (
              <div className="rounded-lg border border-gray-200 bg-white/95 p-6 backdrop-blur-sm">
                <h2 className="mb-6 text-xl font-semibold text-[#2C2C2C]">Price vs Likes</h2>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="price" name="Price" unit="$" />
                      <YAxis type="number" dataKey="likes" name="Likes" />
                      <ZAxis type="number" dataKey="rating" range={[50, 300]} name="Rating" />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                      <Legend />
                      <Scatter name="Artworks" data={scatterData} fill="#D4AF37" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {viewMode === "grid" && (
          <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 xl:grid-cols-3 fade-up fade-up-delay-1">
            {browseArtworksForDisplay.map((artwork) => {
              const avgRating = getAverageRating(artwork);
              const isLiked = likedArtworks.has(artwork.id);

              return (
                <article key={artwork.id} className="motion-card overflow-hidden rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm transition-shadow">
                  <div className="relative">
                    <img src={artwork.imageUrl} alt={artwork.title} className="h-64 w-full object-cover" />
                    <button onClick={() => toggleLike(artwork.id)} title="Toggle like" aria-label="Toggle like" className="absolute right-3 top-3 rounded-full bg-white/90 p-2 hover:bg-white">
                      <Heart size={18} fill={isLiked ? "#DC2626" : "none"} stroke={isLiked ? "#DC2626" : "#666666"} />
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg text-[#2C2C2C]">{artwork.title}</h3>
                    <p className="text-sm text-[#627d9a]">{artwork.artist}</p>
                    <p className="text-xs text-[#666666]">{artwork.year}</p>
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <StarRating rating={avgRating} size={14} />
                        <span className="text-xs text-[#666666]">({artwork.reviews.length})</span>
                      </div>
                      <span className="text-base text-[#D4AF37]">${artwork.price.toLocaleString()}</span>
                    </div>
                    <div className="mt-3">
                      <Link to={`/artwork/${artwork.id}`} className="inline-flex items-center gap-2 rounded-md bg-[#2C2C2C] px-4 py-2 text-white hover:opacity-90">
                        <Eye className="h-4 w-4" />
                        View
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {viewMode === "list" && (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/60">
                  <TableHead className="text-[#2C2C2C]">Title</TableHead>
                  <TableHead className="text-[#2C2C2C]">Artist</TableHead>
                  <TableHead className="text-[#2C2C2C]">Rating</TableHead>
                  <TableHead className="text-[#2C2C2C]">Likes</TableHead>
                  <TableHead className="text-[#2C2C2C]">Price</TableHead>
                  <TableHead className="text-right text-[#2C2C2C]">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {browseArtworksForDisplay.map((artwork) => {
                  const avgRating = getAverageRating(artwork);
                  return (
                    <TableRow key={artwork.id}>
                      <TableCell className="text-[#2C2C2C]">{artwork.title}</TableCell>
                      <TableCell className="text-[#627d9a]">{artwork.artist}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StarRating rating={avgRating} size={14} />
                          <span className="text-xs text-[#666666]">({artwork.reviews.length})</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[#666666]">{artwork.likes}</TableCell>
                      <TableCell className="text-[#D4AF37]">${artwork.price.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Link to={`/artwork/${artwork.id}`} className="inline-flex items-center gap-2 rounded-md bg-[#2C2C2C] px-4 py-2 text-white hover:opacity-90">
                          <Eye className="h-4 w-4" />
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {viewMode === "split" && (canCreateArtwork || canEditArtwork || canDeleteArtwork) && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white/95 backdrop-blur-sm">
              <div className="border-b border-gray-200 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg text-[#2C2C2C]">Inline Table CRUD</h3>
                  {canCreateArtwork && (
                    <button
                      onClick={() => setShowQuickAdd((prev) => !prev)}
                      className="motion-button inline-flex items-center gap-2 rounded-md bg-[#D4AF37] px-4 py-2 text-white"
                    >
                      <Plus className="h-4 w-4" />
                      {showQuickAdd ? "Hide Add" : "Quick Add"}
                    </button>
                  )}
                </div>

                {canCreateArtwork && showQuickAdd && (
                  <form onSubmit={handleQuickAddSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input value={quickAddValues.title} onChange={handleQuickAddChange("title")} placeholder="Title" className="rounded-md border border-gray-300 px-3 py-2" />
                    <input value={quickAddValues.artist} onChange={handleQuickAddChange("artist")} placeholder="Artist" className="rounded-md border border-gray-300 px-3 py-2" />
                    <input value={quickAddValues.year} onChange={handleQuickAddChange("year")} placeholder="Year" type="number" className="rounded-md border border-gray-300 px-3 py-2" />
                    <input value={quickAddValues.price} onChange={handleQuickAddChange("price")} placeholder="Price" type="number" className="rounded-md border border-gray-300 px-3 py-2" />
                    <input value={quickAddValues.category} onChange={handleQuickAddChange("category")} placeholder="Category" className="rounded-md border border-gray-300 px-3 py-2" />
                    <input value={quickAddValues.imageUrl} onChange={handleQuickAddChange("imageUrl")} placeholder="Image URL" className="rounded-md border border-gray-300 px-3 py-2" />
                    <textarea value={quickAddValues.description} onChange={handleQuickAddChange("description")} placeholder="Description" rows={2} className="rounded-md border border-gray-300 px-3 py-2 md:col-span-2" />
                    {Object.values(quickAddErrors).some(Boolean) && (
                      <p className="text-sm text-red-600 md:col-span-2">Please correct invalid fields before adding.</p>
                    )}
                    <div className="md:col-span-2 flex items-center gap-2">
                      <button type="submit" className="motion-button rounded-md bg-[#2C2C2C] px-4 py-2 text-white">Add Artwork</button>
                      <button type="button" onClick={() => setShowQuickAdd(false)} className="rounded-md border border-gray-300 px-4 py-2 text-[#2C2C2C]">Cancel</button>
                    </div>
                  </form>
                )}

                {canEditArtwork && editingArtworkId && (
                  <form onSubmit={saveInlineEdit} className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-200 pt-4 md:grid-cols-2">
                    <input value={editValues.title} onChange={handleEditChange("title")} placeholder="Title" className="rounded-md border border-gray-300 px-3 py-2" />
                    <input value={editValues.artist} onChange={handleEditChange("artist")} placeholder="Artist" className="rounded-md border border-gray-300 px-3 py-2" />
                    <input value={editValues.year} onChange={handleEditChange("year")} placeholder="Year" type="number" className="rounded-md border border-gray-300 px-3 py-2" />
                    <input value={editValues.price} onChange={handleEditChange("price")} placeholder="Price" type="number" className="rounded-md border border-gray-300 px-3 py-2" />
                    <input value={editValues.category} onChange={handleEditChange("category")} placeholder="Category" className="rounded-md border border-gray-300 px-3 py-2" />
                    <input value={editValues.imageUrl} onChange={handleEditChange("imageUrl")} placeholder="Image URL" className="rounded-md border border-gray-300 px-3 py-2" />
                    <textarea value={editValues.description} onChange={handleEditChange("description")} placeholder="Description" rows={2} className="rounded-md border border-gray-300 px-3 py-2 md:col-span-2" />
                    {Object.values(editErrors).some(Boolean) && (
                      <p className="text-sm text-red-600 md:col-span-2">Please correct invalid fields before saving.</p>
                    )}
                    <div className="md:col-span-2 flex items-center gap-2">
                      <button type="submit" className="motion-button inline-flex items-center gap-2 rounded-md bg-[#2C2C2C] px-4 py-2 text-white"><Check className="h-4 w-4" />Save Changes</button>
                      <button type="button" onClick={cancelInlineEdit} className="rounded-md border border-gray-300 px-4 py-2 text-[#2C2C2C]">Cancel</button>
                    </div>
                  </form>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/60">
                    <TableHead className="text-[#2C2C2C]">Title</TableHead>
                    <TableHead className="text-[#2C2C2C]">Artist</TableHead>
                    <TableHead className="text-[#2C2C2C]">Rating</TableHead>
                    <TableHead className="text-[#2C2C2C]">Likes</TableHead>
                    <TableHead className="text-[#2C2C2C]">Price</TableHead>
                    <TableHead className="text-right text-[#2C2C2C]">View</TableHead>
                    {(canEditArtwork || canDeleteArtwork) && <TableHead className="text-right text-[#2C2C2C]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {splitArtworks.map((artwork) => {
                    const avgRating = getAverageRating(artwork);
                    return (
                      <TableRow key={artwork.id}>
                        <TableCell className="text-[#2C2C2C]">{artwork.title}</TableCell>
                        <TableCell className="text-[#627d9a]">{artwork.artist}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StarRating rating={avgRating} size={14} />
                            <span className="text-xs text-[#666666]">({artwork.reviews.length})</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[#666666]">{artwork.likes}</TableCell>
                        <TableCell className="text-[#D4AF37]">${artwork.price.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Link to={`/artwork/${artwork.id}`} className="inline-flex items-center gap-2 rounded-md bg-[#2C2C2C] px-4 py-2 text-white hover:opacity-90">
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                        </TableCell>
                        {(canEditArtwork || canDeleteArtwork) && (
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-2">
                              {canEditArtwork && (
                                <button
                                  type="button"
                                  onClick={() => startInlineEdit(artwork)}
                                  className="motion-button inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-2 text-[#2C2C2C]"
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </button>
                              )}
                              {canDeleteArtwork && (
                                <button
                                  type="button"
                                  onClick={() => deleteInlineArtwork(artwork)}
                                  className="motion-button inline-flex items-center gap-1 rounded-md bg-[#FEE2E2] px-3 py-2 text-[#DC2626]"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white/95 p-4 backdrop-blur-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-[#666666]">Visible Artworks</h3>
                    <BarChart3 className="h-5 w-5 text-[#D4AF37]" />
                  </div>
                  <p className="text-2xl font-bold text-[#2C2C2C]">{totalArtworks}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white/95 p-4 backdrop-blur-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-[#666666]">Average Price</h3>
                    <DollarSign className="h-5 w-5 text-[#D4AF37]" />
                  </div>
                  <p className="text-2xl font-bold text-[#2C2C2C]">${averagePrice.toLocaleString()}</p>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white/95 p-4 backdrop-blur-sm">
                <h2 className="mb-4 text-lg font-semibold text-[#2C2C2C]">Table-Linked Statistics</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={priceRanges}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#D4AF37" name="Artworks" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white/95 p-4 backdrop-blur-sm">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="price" name="Price" unit="$" />
                      <YAxis type="number" dataKey="likes" name="Likes" />
                      <ZAxis type="number" dataKey="rating" range={[50, 300]} name="Rating" />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                      <Legend />
                      <Scatter name="Visible Artworks" data={scatterData} fill="#627d9a" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode !== "stats" && viewMode !== "split" && (
          <div className="mt-8 space-y-4">
            <div ref={browseSentinelRef} className="h-px w-full" aria-hidden="true" />

            <div className="flex flex-col items-center justify-center gap-3 text-sm text-[#666666] sm:flex-row">
              {isInitialBrowseLoading ? (
                <span>Loading artworks...</span>
              ) : hasMoreBrowsePages ? (
                <>
                  <span>Scroll to load more artworks.</span>
                  <button
                    type="button"
                    onClick={loadMoreBrowseArtworks}
                    disabled={isFetchingNextPage}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-[#2C2C2C] disabled:opacity-50"
                  >
                    <ChevronDown className="h-4 w-4" />
                    {isFetchingNextPage ? "Loading more..." : "Load more"}
                  </button>
                </>
              ) : (
                <span>No more artworks to load.</span>
              )}
            </div>

            {browseError && (
              <p className="text-center text-sm text-[#DC2626]">{browseError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
