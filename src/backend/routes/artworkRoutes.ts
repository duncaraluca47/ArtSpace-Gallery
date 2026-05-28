import { Router } from "express";
import type { ArtworkService } from "../services/artworkService";
import {
  artworkCreateSchema,
  artworkUpdateSchema,
  idParamSchema,
  listQuerySchema,
} from "../validation/artworkSchemas";
import { reviewCreateSchema, reviewUpdateSchema, reviewIdParamSchema } from "../validation/artworkSchemas";
import { formatZodError } from "./helpers";
import { getAuthenticatedUser, requireAuth, requirePermission } from "../../middleware/requireAuth";

export function createArtworkRouter(service: ArtworkService) {
  const router = Router();

  router.get("/", (req, res) => {
    const parsedQuery = listQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      return res.status(400).json({
        message: "Invalid pagination or filter query parameters.",
        errors: formatZodError(parsedQuery.error),
      });
    }

    const result = service.list(parsedQuery.data);
    return res.status(200).json(result);
  });

  router.get("/:id", (req, res) => {
    const parsedParam = idParamSchema.safeParse(req.params);

    if (!parsedParam.success) {
      return res.status(400).json({
        message: "Invalid artwork id.",
        errors: formatZodError(parsedParam.error),
      });
    }

    const artwork = service.getById(parsedParam.data.id);

    if (!artwork) {
      return res.status(404).json({ message: "Artwork not found." });
    }

    return res.status(200).json(artwork);
  });

  router.post("/", requireAuth, requirePermission("artwork:create"), (req, res) => {
    const parsedBody = artworkCreateSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        message: "Validation failed.",
        errors: formatZodError(parsedBody.error),
      });
    }

    const created = service.create(parsedBody.data);
    return res.status(201).json(created);
  });

  router.put("/:id", requireAuth, requirePermission("artwork:edit"), (req, res) => {
    const parsedParam = idParamSchema.safeParse(req.params);

    if (!parsedParam.success) {
      return res.status(400).json({
        message: "Invalid artwork id.",
        errors: formatZodError(parsedParam.error),
      });
    }

    const parsedBody = artworkUpdateSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        message: "Validation failed.",
        errors: formatZodError(parsedBody.error),
      });
    }

    const updated = service.update(parsedParam.data.id, parsedBody.data);

    if (!updated) {
      return res.status(404).json({ message: "Artwork not found." });
    }

    return res.status(200).json(updated);
  });

  router.delete("/:id", requireAuth, requirePermission("artwork:delete"), (req, res) => {
    const parsedParam = idParamSchema.safeParse(req.params);

    if (!parsedParam.success) {
      return res.status(400).json({
        message: "Invalid artwork id.",
        errors: formatZodError(parsedParam.error),
      });
    }

    const deleted = service.remove(parsedParam.data.id);

    if (!deleted) {
      return res.status(404).json({ message: "Artwork not found." });
    }

    return res.status(200).json({ success: true });
  });

  // Reviews (1-to-many)
  router.get("/:id/reviews", (req, res) => {
    const parsedParam = idParamSchema.safeParse(req.params);
    if (!parsedParam.success) {
      return res.status(400).json({ message: "Invalid artwork id.", errors: formatZodError(parsedParam.error) });
    }

    const reviews = service.listReviews(parsedParam.data.id);
    if (reviews === null) return res.status(404).json({ message: "Artwork not found." });
    return res.status(200).json(reviews);
  });

  router.post("/:id/reviews", requireAuth, (req, res) => {
    const parsedParam = idParamSchema.safeParse(req.params);
    if (!parsedParam.success) {
      return res.status(400).json({ message: "Invalid artwork id.", errors: formatZodError(parsedParam.error) });
    }

    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    const parsedBody = reviewCreateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ message: "Validation failed.", errors: formatZodError(parsedBody.error) });
    }

    const review = {
      id: String(Date.now()) + Math.random().toString(36).slice(2, 8),
      userName: currentUser.username,
      rating: parsedBody.data.rating,
      comment: parsedBody.data.comment,
      date: new Date().toISOString().slice(0, 10),
    };

    const created = service.createReview(parsedParam.data.id, review);
    if (!created) return res.status(404).json({ message: "Artwork not found." });
    return res.status(201).json(created);
  });

  router.put("/:id/reviews/:reviewId", (req, res) => {
    const parsedParam = idParamSchema.safeParse(req.params);
    const parsedReviewParam = reviewIdParamSchema.safeParse(req.params);
    if (!parsedParam.success || !parsedReviewParam.success) {
      return res.status(400).json({ message: "Invalid ids.", errors: formatZodError(parsedParam.success ? parsedReviewParam.error! : parsedParam.error) });
    }

    const currentUser = getAuthenticatedUser(req) ?? req.user;
    if (!currentUser) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    const artwork = service.getById(parsedParam.data.id);
    if (!artwork) {
      return res.status(404).json({ message: "Artwork or review not found." });
    }

    const review = artwork.reviews.find((item) => item.id === parsedReviewParam.data.reviewId);
    if (!review) {
      return res.status(404).json({ message: "Artwork or review not found." });
    }

    if (review.userName !== currentUser.username) {
      return res.status(403).json({ message: "You can only edit your own review." });
    }

    const parsedBody = reviewUpdateSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({ message: "Validation failed.", errors: formatZodError(parsedBody.error) });
    }

    const updated = service.updateReview(parsedParam.data.id, parsedReviewParam.data.reviewId, {
      ...parsedBody.data,
      userName: currentUser.username,
    });
    if (!updated) return res.status(404).json({ message: "Artwork or review not found." });
    return res.status(200).json(updated);
  });

  router.delete("/:id/reviews/:reviewId", (req, res) => {
    const parsedParam = idParamSchema.safeParse(req.params);
    const parsedReviewParam = reviewIdParamSchema.safeParse(req.params);
    if (!parsedParam.success || !parsedReviewParam.success) {
      return res.status(400).json({ message: "Invalid ids.", errors: formatZodError(parsedParam.success ? parsedReviewParam.error! : parsedParam.error) });
    }

    const currentUser = getAuthenticatedUser(req) ?? req.user;
    if (!currentUser) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    const artwork = service.getById(parsedParam.data.id);
    if (!artwork) {
      return res.status(404).json({ message: "Artwork or review not found." });
    }

    const review = artwork.reviews.find((item) => item.id === parsedReviewParam.data.reviewId);
    if (!review) {
      return res.status(404).json({ message: "Artwork or review not found." });
    }

    const canDeleteReview = currentUser.role === "admin" || review.userName === currentUser.username;

    if (!canDeleteReview) {
      return res.status(403).json({ message: "You can only delete your own review." });
    }

    const deleted = service.deleteReview(parsedParam.data.id, parsedReviewParam.data.reviewId);
    if (!deleted) return res.status(404).json({ message: "Artwork or review not found." });
    return res.status(204).send();
  });

  return router;
}
