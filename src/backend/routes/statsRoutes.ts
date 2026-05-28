import { Router } from "express";
import type { ArtworkService } from "../services/artworkService";
import { requireAuth } from "../../middleware/requireAuth";

export function createStatsRouter(service: ArtworkService) {
  const router = Router();

  router.get("/overview", requireAuth, async (req, res) => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const stats = await service.getStats();
    return res.status(200).json(stats);
  });

  return router;
}
