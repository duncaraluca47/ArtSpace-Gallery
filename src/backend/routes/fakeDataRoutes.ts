import { Router } from "express";
import type { FakeDataGenerator } from "../services/fakeDataGenerator";
import type { ArtworkService } from "../services/artworkService";
import { requireAuth, requirePermission } from "../../middleware/requireAuth";

export function createFakeDataRouter(
  generator: FakeDataGenerator,
  service: ArtworkService
) {
  const router = Router();

  /**
   * POST /api/fake-data/start - Start generating fake data
   * Query params:
   *   - batchSize: Number of items per batch (default: 3)
   *   - intervalMs: Interval between batches in ms (default: 5000)
   */
  router.post("/start", requireAuth, requirePermission("artwork:create"), (req, res) => {
    if (generator.isActive()) {
      return res.status(400).json({
        error: "Fake data generation is already running",
      });
    }

    const batchSize = Number(req.query.batchSize ?? 3);
    const intervalMs = Number(req.query.intervalMs ?? 5000);

    generator.startGeneration(batchSize, intervalMs, (artworks) => {
      artworks.forEach((artwork) => {
        service.create(artwork, true);
      });
    });

    res.status(200).json({
      message: "Fake data generation started",
      batchSize,
      intervalMs,
      status: "generating",
    });
  });

  /**
   * POST /api/fake-data/stop - Stop generating fake data
   */
  router.post("/stop", requireAuth, requirePermission("artwork:create"), (req, res) => {
    if (!generator.isActive()) {
      return res.status(400).json({
        error: "Fake data generation is not running",
      });
    }

    generator.stopGeneration();

    res.status(200).json({
      message: "Fake data generation stopped",
      status: "stopped",
    });
  });

  /**
   * GET /api/fake-data/status - Check if generation is active
   */
  router.get("/status", requireAuth, requirePermission("artwork:create"), (req, res) => {
    res.status(200).json({
      isActive: generator.isActive(),
      status: generator.isActive() ? "generating" : "idle",
    });
  });

  return router;
}
