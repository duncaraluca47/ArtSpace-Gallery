-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "averageRating" DOUBLE PRECISION;

-- Recompute cached average rating for the affected artwork row.
CREATE OR REPLACE FUNCTION update_artwork_average_rating()
RETURNS TRIGGER AS $$
DECLARE
	target_artwork_id TEXT;
	calculated_avg DOUBLE PRECISION;
BEGIN
	target_artwork_id := COALESCE(NEW."artworkId", OLD."artworkId");

	SELECT AVG("rating")::DOUBLE PRECISION
	INTO calculated_avg
	FROM "Review"
	WHERE "artworkId" = target_artwork_id;

	UPDATE "Artwork"
	SET "averageRating" = calculated_avg
	WHERE "id" = target_artwork_id;

	RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS review_average_rating_insert_delete ON "Review";

CREATE TRIGGER review_average_rating_insert_delete
AFTER INSERT OR DELETE ON "Review"
FOR EACH ROW
EXECUTE FUNCTION update_artwork_average_rating();
