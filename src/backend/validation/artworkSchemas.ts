import { z } from "zod";

const currentYear = new Date().getFullYear();

const nonEmptyString = z.string().trim().min(1, "Field is required.");

export const artworkCreateSchema = z.object({
  id: z.string().trim().min(1).optional(),
  title: nonEmptyString.min(2, "Title must have at least 2 characters."),
  artist: nonEmptyString.min(2, "Artist must have at least 2 characters."),
  year: z
    .coerce.number({ message: "Year must be a number." })
    .int("Year must be an integer.")
    .min(1000, "Year must be at least 1000.")
    .max(currentYear + 1, `Year must be at most ${currentYear + 1}.`),
  price: z
    .coerce.number({ message: "Price must be a number." })
    .positive("Price must be greater than zero.")
    .max(1_000_000, "Price must not exceed 1000000."),
  category: nonEmptyString.min(2, "Category must have at least 2 characters."),
  description: nonEmptyString.min(
    20,
    "Description must have at least 20 characters.",
  ),
  imageUrl: z.url("Image URL must be a valid URL."),
});

export const artworkUpdateSchema = artworkCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update.",
  });

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(5),
  artist: z.string().trim().optional(),
  category: z.string().trim().optional(),
  search: z.string().trim().optional(),
});

export const idParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const reviewCreateSchema = z.object({
  userName: nonEmptyString.min(2, "Name must have at least 2 characters."),
  rating: z.coerce.number().int().min(1).max(5),
  comment: nonEmptyString.min(3, "Comment must have at least 3 characters."),
});

export const reviewUpdateSchema = reviewCreateSchema.partial().refine((d) => Object.keys(d).length > 0, {
  message: "At least one field must be provided for review update.",
});

export const reviewIdParamSchema = z.object({
  reviewId: z.string().trim().min(1),
});
