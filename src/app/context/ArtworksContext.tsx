import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Artwork } from "../data/artworks";
import {
  createArtwork,
  removeArtworkById,
  updateArtworkById,
  type ArtworkDraft,
} from "../state/artworksStore";
import {
  createSeedArtworksSnapshot,
  describeSyncError,
  loadPersistedArtworks,
  loadPersistedOperations,
  probeArtworkServer,
  savePersistedArtworks,
  savePersistedOperations,
  syncArtworkOperation,
  type ArtworkSyncOperationExtended,
  type ArtworkSyncStatus,
} from "../services/artworkSync";
import {
  getRealtimeArtworkService,
  type WebSocketMessage,
} from "../services/realtimeArtworkService";

type ArtworksContextValue = {
  artworks: Artwork[];
  addArtwork: (draft: ArtworkDraft) => Artwork;
  updateArtwork: (id: string, draft: ArtworkDraft) => void;
  deleteArtwork: (id: string) => void;
  addReview: (artworkId: string, userName: string, rating: number, comment: string) => Promise<void>;
  updateReview: (artworkId: string, reviewId: string, userName: string, rating: number, comment: string) => Promise<void>;
  deleteReview: (artworkId: string, reviewId: string) => Promise<void>;
  syncStatus: ArtworkSyncStatus;
};

const ArtworksContext = createContext<ArtworksContextValue | undefined>(undefined);

function getInitialArtworks() {
  return loadPersistedArtworks() ?? createSeedArtworksSnapshot();
}

function getInitialOperations() {
  return loadPersistedOperations();
}

export function ArtworksProvider({ children }: { children: ReactNode }) {
  const [artworks, setArtworks] = useState<Artwork[]>(getInitialArtworks);
  const [pendingOperations, setPendingOperations] = useState<ArtworkSyncOperationExtended[]>(getInitialOperations);
  const [syncStatus, setSyncStatus] = useState<ArtworkSyncStatus>(() => ({
    mode: typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
    pendingOperations: getInitialOperations().length,
    lastError: null,
  }));

  const pendingOperationsRef = useRef(pendingOperations);
  const syncingRef = useRef(false);

  useEffect(() => {
    savePersistedArtworks(artworks);
  }, [artworks]);

  useEffect(() => {
    pendingOperationsRef.current = pendingOperations;
    savePersistedOperations(pendingOperations);
  }, [pendingOperations]);

  const enqueueOperation = useCallback((operation: ArtworkSyncOperationExtended) => {
    const nextOperations = [...pendingOperationsRef.current, operation];
    pendingOperationsRef.current = nextOperations;
    setPendingOperations(nextOperations);
    setSyncStatus((current) => ({
      ...current,
      pendingOperations: nextOperations.length,
      mode: current.mode === "offline" ? "offline" : current.mode,
    }));
  }, []);

  const flushPendingOperations = useCallback(async () => {
    if (syncingRef.current) {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncStatus({
        mode: "offline",
        pendingOperations: pendingOperationsRef.current.length,
        lastError: "Connection is offline.",
      });
      return;
    }

    syncingRef.current = true;
    setSyncStatus({
      mode: "syncing",
      pendingOperations: pendingOperationsRef.current.length,
      lastError: null,
    });

    try {
      await probeArtworkServer();

      while (pendingOperationsRef.current.length > 0) {
        const operation = pendingOperationsRef.current[0];
        await syncArtworkOperation(operation);

        const [, ...rest] = pendingOperationsRef.current;
        pendingOperationsRef.current = rest;
        setPendingOperations(rest);
        savePersistedOperations(rest);
      }

      setSyncStatus({
        mode: "online",
        pendingOperations: 0,
        lastError: null,
      });
    } catch (error) {
      const message = describeSyncError(error);
      setSyncStatus({
        mode: "offline",
        pendingOperations: pendingOperationsRef.current.length,
        lastError: message,
      });
    } finally {
      syncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      void flushPendingOperations();
    };

    const handleOffline = () => {
      setSyncStatus({
        mode: "offline",
        pendingOperations: pendingOperationsRef.current.length,
        lastError: "Connection is offline.",
      });
    };

    // Connect to WebSocket for real-time updates
    const realtimeService = getRealtimeArtworkService();
    realtimeService.connect().catch((error) => {
      console.error("Failed to connect to WebSocket:", error);
    });

    const unsubscribe = realtimeService.subscribe((message: WebSocketMessage) => {
      if (message.type === "artworks_created" && message.data) {
        // Add newly generated artworks to the context
        setArtworks((current) => [...current, ...message.data!]);
      } else if (message.type === "generation_stopped") {
        console.log("Fake data generation stopped");
      }
    });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Actively probe backend health to detect server availability
    // This checks if the backend is actually reachable, not just the browser's internet
    const pollBackendHealth = async () => {
      try {
        await probeArtworkServer();
        
        // Backend is reachable
        setSyncStatus((current) => {
          if (current.mode !== "online") {
            return {
              mode: "online",
              pendingOperations: pendingOperationsRef.current.length,
              lastError: null,
            };
          }
          return current;
        });
        
        // Attempt to flush pending operations if we just came online
        if (pendingOperationsRef.current.length > 0) {
          void flushPendingOperations();
        }
      } catch (error) {
        // Backend is not reachable
        setSyncStatus((current) => {
          if (current.mode !== "offline") {
            return {
              mode: "offline",
              pendingOperations: pendingOperationsRef.current.length,
              lastError: "Backend server is not reachable.",
            };
          }
          return current;
        });
      }
    };

    // Poll backend health every 2 seconds
    const pollInterval = setInterval(() => {
      void pollBackendHealth();
    }, 2000);

    // Initial check
    void pollBackendHealth();

    void flushPendingOperations();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(pollInterval);
      unsubscribe();
    };
  }, [flushPendingOperations]);

  const value = useMemo<ArtworksContextValue>(() => ({
    artworks,
    addArtwork(draft) {
      const newArtwork = createArtwork(draft);

      setArtworks((current) => [...current, newArtwork]);
      enqueueOperation({
        id: newArtwork.id,
        type: "create",
        artwork: newArtwork,
      });
      void flushPendingOperations();
      return newArtwork;
    },
    updateArtwork(id, draft) {
      setArtworks((current) => updateArtworkById(current, id, draft));
      enqueueOperation({
        id: `${id}:update:${Date.now()}`,
        type: "update",
        artworkId: id,
        draft,
      });
      void flushPendingOperations();
    },
    deleteArtwork(id) {
      setArtworks((current) => removeArtworkById(current, id));
      enqueueOperation({
        id: `${id}:delete:${Date.now()}`,
        type: "delete",
        artworkId: id,
      });
      void flushPendingOperations();
    },
    async addReview(artworkId, userName, rating, comment) {
      // optimistic local update
      const review = {
        id: String(Date.now()) + Math.random().toString(36).slice(2, 8),
        userName,
        rating,
        comment,
        date: new Date().toISOString().slice(0, 10),
      } as const;

      setArtworks((current) => current.map((a) => (a.id === artworkId ? { ...a, reviews: [...a.reviews, review] } : a)));

      // enqueue for sync
      enqueueOperation({
        id: `${artworkId}:review:create:${Date.now()}`,
        type: "review:create",
        artworkId,
        review,
      });

      void flushPendingOperations();
    },
    async updateReview(artworkId, reviewId, userName, rating, comment) {
      // optimistic local update
      const data = { userName, rating, comment };
      setArtworks((current) => current.map((a) => (a.id === artworkId ? { ...a, reviews: a.reviews.map((r) => (r.id === reviewId ? { ...r, ...data } : r)) } : a)));

      enqueueOperation({
        id: `${artworkId}:review:update:${Date.now()}`,
        type: "review:update",
        artworkId,
        reviewId,
        data,
      });

      void flushPendingOperations();
    },
    async deleteReview(artworkId, reviewId) {
      // optimistic local removal
      setArtworks((current) => current.map((a) => (a.id === artworkId ? { ...a, reviews: a.reviews.filter((r) => r.id !== reviewId) } : a)));

      enqueueOperation({
        id: `${artworkId}:review:delete:${Date.now()}`,
        type: "review:delete",
        artworkId,
        reviewId,
      });

      void flushPendingOperations();
    },
    syncStatus,
  }), [artworks, enqueueOperation, flushPendingOperations, syncStatus]);

  return <ArtworksContext.Provider value={value}>{children}</ArtworksContext.Provider>;
}

export function useArtworks() {
  const context = useContext(ArtworksContext);
  if (!context) {
    throw new Error("useArtworks must be used inside ArtworksProvider");
  }

  return context;
}

export type { ArtworkDraft };
