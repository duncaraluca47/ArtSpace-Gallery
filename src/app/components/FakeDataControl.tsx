import React, { useEffect, useState } from "react";
import { Button } from "../components/ui/button";

interface FakeDataControlProps {
  batchSize?: number;
  intervalMs?: number;
}

/**
 * Component to control fake data generation
 * Allows starting and stopping the async loop that generates fake artworks
 */
export function FakeDataControl({
  batchSize = 3,
  intervalMs = 5000,
}: FakeDataControlProps) {
  const apiBaseUrl = `${import.meta.env.VITE_BACKEND_URL ?? ""}/api`;
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check initial status
  useEffect(() => {
    checkGenerationStatus();
  }, []);

  const checkGenerationStatus = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/fake-data/status`);
      if (response.ok) {
        const data = await response.json();
        setIsGenerating(data.isActive);
      }
    } catch (error) {
      // Silently fail if API is not available (e.g., in tests)
      console.debug("Could not check generation status:", error);
    }
  };

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${apiBaseUrl}/fake-data/start?batchSize=${batchSize}&intervalMs=${intervalMs}`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        setIsGenerating(true);
      } else {
        const error = await response.json();
        console.error("Failed to start generation:", error);
      }
    } catch (error) {
      console.error("Failed to start fake data generation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/fake-data/stop`, {
        method: "POST",
      });

      if (response.ok) {
        setIsGenerating(false);
      } else {
        const error = await response.json();
        console.error("Failed to stop generation:", error);
      }
    } catch (error) {
      console.error("Failed to stop fake data generation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isGenerating ? (
        <>
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <div className="h-2 w-2 rounded-full bg-amber-600 animate-pulse" />
            Generating fake data...
          </div>
          <Button
            onClick={handleStop}
            disabled={isLoading}
            variant="destructive"
            size="sm"
          >
            {isLoading ? "Stopping..." : "Stop"}
          </Button>
        </>
      ) : (
        <Button
          onClick={handleStart}
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          {isLoading ? "Starting..." : "Start Demo Data"}
        </Button>
      )}
    </div>
  );
}
