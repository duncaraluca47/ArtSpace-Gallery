CREATE OR REPLACE VIEW "artwork_stats_view" AS
SELECT
	(SELECT COUNT(*)::INT FROM "Artwork") AS "totalArtworks",
	(SELECT COUNT(*)::INT FROM "Review") AS "totalReviews",
	COALESCE((SELECT AVG("price") FROM "Artwork"), 0)::DOUBLE PRECISION AS "averagePrice",
	COALESCE((SELECT AVG("rating") FROM "Review"), 0)::DOUBLE PRECISION AS "averageRating",
	(SELECT COUNT(*)::INT FROM "Artwork" WHERE "forSale" = TRUE) AS "forSaleCount",
	COALESCE(
		(
			SELECT jsonb_agg(
				jsonb_build_object('medium', grouped."medium", 'count', grouped."count")
				ORDER BY grouped."count" DESC, grouped."medium" ASC
			)
			FROM (
				SELECT "medium", COUNT(*)::INT AS "count"
				FROM "Artwork"
				GROUP BY "medium"
			) AS grouped
		),
		'[]'::jsonb
	) AS "countByMedium";