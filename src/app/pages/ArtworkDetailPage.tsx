import { useParams, Link, useNavigate } from "react-router";
import { Navigation } from "../components/Navigation";
import { Edit, Trash2, ArrowLeft, Heart, Star as StarIcon } from "lucide-react";
import { useState } from "react";
import { DeleteConfirmationModal } from "../components/DeleteConfirmationModal";
import { ReviewModal } from "../components/ReviewModal";
import { StarRating } from "../components/StarRating";
import { useArtworks } from "../context/ArtworksContext";
import { trackAction } from "../monitoring/activityMonitor";
import { useAuth } from "../../context/AuthContext";

export function ArtworkDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { artworks, deleteArtwork } = useArtworks();
  const { hasPermission, user } = useAuth();
  const artwork = artworks.find((a) => a.id === id);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [editingReview, setEditingReview] = useState<null | { id: string; userName: string; rating: number; comment: string }>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const DESCRIPTION_LIMIT = 160;
  const canEditArtwork = hasPermission("artwork:edit");
  const canDeleteArtwork = hasPermission("artwork:delete");
  const canEditReview = (review: { userName: string }) => Boolean(user && review.userName === user.username);
  const canDeleteReview = (review: { userName: string }) => Boolean(user && (user.role === "admin" || review.userName === user.username));

  if (!artwork) {
    return (
      <div className="min-h-screen bg-cover bg-center [background-image:url('https://upload.wikimedia.org/wikipedia/commons/7/78/Claude_Monet_-_The_Magpie_-_Google_Art_Project.jpg')]">
        <Navigation />
        <div className="max-w-screen-xl mx-auto px-8 py-24 text-center">
          <div className="bg-white/95 backdrop-blur-sm p-12 rounded-2xl inline-block shadow-xl">
            <h1 className="text-3xl mb-4 font-light text-[#2C2C2C]">
              Artwork not found
            </h1>
            <Link to="/gallery" className="text-[#D4AF37]">
              Return to Gallery
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleDelete = () => {
    if (artwork) {
      deleteArtwork(artwork.id);
      trackAction("artwork_deleted");
    }
    setShowDeleteModal(false);
    navigate("/gallery");
  };

  const { addReview, updateReview, deleteReview } = useArtworks();

  const handleReviewSubmit = async (userName: string, rating: number, comment: string) => {
    try {
      if (editingReview) {
        await updateReview(artwork.id, editingReview.id, userName, rating, comment);
        setEditingReview(null);
      } else {
        await addReview(artwork.id, userName, rating, comment);
      }
      trackAction("review_submitted");
    } catch (err) {
      console.error(err);
    }
  };

  const getAverageRating = () => {
    if (artwork.reviews.length === 0) return 0;
    const sum = artwork.reviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / artwork.reviews.length;
  };

  const avgRating = getAverageRating();

  return (
    <div className="min-h-screen bg-fixed bg-cover bg-center [background-image:url('https://upload.wikimedia.org/wikipedia/commons/7/78/Claude_Monet_-_The_Magpie_-_Google_Art_Project.jpg')]">
      <Navigation />

      <div className="max-w-screen-xl mx-auto px-8 py-10">
        {/* Back Link */}
        <Link
          to="/gallery"
          className="inline-flex items-center gap-2 mb-8 text-sm font-medium transition-colors bg-white/90 text-[#666666] backdrop-blur-sm px-4 py-2 rounded-full shadow-sm hover:bg-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Gallery
        </Link>

        {/* Main Content Card */}
        <div className="bg-white/97 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden">
          <div className="grid grid-cols-2">

            {/* LEFT — Image */}
            <div className="relative bg-gray-50 min-h-[320px]">
              <img
                src={artwork.imageUrl}
                alt={artwork.title}
                className="w-full h-full object-cover min-h-[320px]"
              />
              {/* Like badge overlay */}
              <button
                onClick={() => setIsLiked(!isLiked)}
                className={`absolute top-5 right-5 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-lg transition-all hover:scale-105 backdrop-blur-sm ${isLiked ? "bg-[#DC2626] text-white" : "bg-white/95 text-[#555]"}`}
              >
                <Heart size={16} fill={isLiked ? "white" : "none"} stroke={isLiked ? "white" : "#DC2626"} />
                {isLiked ? "Liked" : "Like"}
              </button>
            </div>

            {/* RIGHT — Details */}
            <div className="flex flex-col p-8 min-h-[320px]">

              {/* Category pill */}
              <span
                className="self-start text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-3 bg-[#FBF3DC] text-[#A07C1A]"
              >
                {artwork.category}
              </span>

              {/* Title & Artist */}
              <h1 className="text-3xl font-light mb-1 leading-tight text-[#1A1A1A]">
                {artwork.title}
              </h1>
              <p className="text-base mb-1 text-[#888]">
                {artwork.artist}
              </p>
              <p className="text-sm mb-4 text-[#AAAAAA]">
                {artwork.year}
              </p>

              {/* Rating Row */}
              <div className="flex items-center gap-3 mb-4">
                <StarRating rating={avgRating} size={18} />
                <span className="text-sm text-[#888]">
                  {avgRating.toFixed(1)} · {artwork.reviews.length}{" "}
                  {artwork.reviews.length === 1 ? "review" : "reviews"}
                </span>
                <span className="mx-2 text-gray-300">|</span>
                <Heart size={15} fill="#DC2626" stroke="#DC2626" />
                <span className="text-sm text-[#888]">
                  {artwork.likes} likes
                </span>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100 mb-4" />

              {/* Price */}
              <p className="text-2xl font-semibold mb-4 text-[#D4AF37]">
                ${artwork.price.toLocaleString()}
              </p>

              {/* Description */}
              <div className="mb-4 flex-1">
                <p className="text-sm leading-relaxed text-[#666]">
                  {descExpanded || artwork.description.length <= DESCRIPTION_LIMIT
                    ? artwork.description
                    : artwork.description.slice(0, DESCRIPTION_LIMIT).trimEnd() + "…"}
                </p>
                {artwork.description.length > DESCRIPTION_LIMIT && (
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="mt-1 text-xs font-medium transition-opacity hover:opacity-70 text-[#D4AF37]"
                  >
                    {descExpanded ? "Show less" : "More"}
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 mt-auto">
                {canEditArtwork && (
                  <Link
                    to={`/edit-artwork/${artwork.id}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-85 bg-[#D4AF37] text-white"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Artwork
                  </Link>
                )}
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-85 bg-[#1A1A1A] text-white"
                >
                  <StarIcon className="w-4 h-4" />
                  Write a Review
                </button>
                {canDeleteArtwork && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-85 bg-[#FEE2E2] text-[#DC2626]"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        {artwork.reviews.length > 0 && (
          <div className="mt-8 bg-white/97 backdrop-blur-md rounded-3xl p-10 shadow-xl">
            <h2 className="text-2xl font-light mb-8 text-[#1A1A1A]">
              Reviews
              <span
                className="ml-3 text-sm font-normal px-2 py-0.5 rounded-full bg-[#F5F5F5] text-[#888]"
              >
                {artwork.reviews.length}
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-6">
              {artwork.reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-2xl p-6 bg-[#FAFAFA] border border-[#F0F0F0]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-sm text-[#1A1A1A]">
                      {review.userName}
                    </span>
                    <div className="flex items-center gap-3">
                      {canEditReview(review) && (
                        <button
                          onClick={() => {
                            setEditingReview({ id: review.id, userName: review.userName, rating: review.rating, comment: review.comment });
                            setShowReviewModal(true);
                          }}
                          className="text-xs text-[#666]"
                          title="Edit review"
                          aria-label={`Edit review ${review.userName}`}
                        >
                          Edit review
                        </button>
                      )}
                      {canDeleteReview(review) && (
                        <button
                          onClick={async () => {
                            try {
                              await deleteReview(artwork.id, review.id);
                              trackAction("review_deleted");
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="text-xs text-[#DC2626]"
                          title="Delete review"
                          aria-label={`Delete review ${review.userName}`}
                        >
                          Delete review
                        </button>
                      )}
                      <span className="text-xs text-[#AAAAAA]">
                        {new Date(review.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="mb-3">
                    <StarRating rating={review.rating} size={14} />
                  </div>
                  <p className="text-sm leading-relaxed text-[#666]">
                    {review.comment}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {canDeleteArtwork && (
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          artwork={artwork}
        />
      )}
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => { setShowReviewModal(false); setEditingReview(null); }}
        onSubmit={handleReviewSubmit}
        artworkTitle={artwork.title}
        initialUserName={editingReview?.userName}
        lockedUserName={user?.username}
        initialRating={editingReview?.rating}
        initialComment={editingReview?.comment}
      />
    </div>
  );
}