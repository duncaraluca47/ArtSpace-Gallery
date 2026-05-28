import { useState } from "react";
import { X } from "lucide-react";
import { StarRating } from "./StarRating";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userName: string, rating: number, comment: string) => void;
  artworkTitle: string;
  initialUserName?: string;
  lockedUserName?: string;
  initialRating?: number;
  initialComment?: string;
}

export function ReviewModal({ isOpen, onClose, onSubmit, artworkTitle, initialUserName = "", lockedUserName, initialRating = 5, initialComment = "" }: ReviewModalProps) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [userName, setUserName] = useState(initialUserName || lockedUserName || "");

  if (!isOpen) return null;

  const effectiveUserName = lockedUserName ?? userName;

  const handleSubmit = () => {
    onSubmit(effectiveUserName || "Guest", rating, comment);
    setRating(5);
    setComment("");
    setUserName("");
    onClose();
  };

  const isValid = effectiveUserName.trim().length >= 2 && comment.trim().length >= 3 && rating >= 1 && rating <= 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full transition-colors"
          title="Close"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-[#666666]" />
        </button>

        {/* Header */}
        <h2 className="text-2xl mb-2 text-[#2C2C2C]">
          Write a Review
        </h2>
        <p className="text-base mb-6 text-[#666666]">
          Share your thoughts about "{artworkTitle}"
        </p>

        {/* Rating */}
        <div className="mb-6">
          <label className="block text-sm mb-2 text-[#2C2C2C]">
            Your Rating
          </label>
          <div className="flex items-center gap-2">
            <StarRating
              rating={rating}
              size={28}
              interactive={true}
              onRatingChange={setRating}
            />
            <span className="text-base text-[#666666]">
              ({rating} {rating === 1 ? 'star' : 'stars'})
            </span>
          </div>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="block text-sm mb-2 text-[#2C2C2C]">Your Name</label>
          <input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Your name"
            readOnly={Boolean(lockedUserName)}
            className="w-full px-4 py-3 border border-gray-300 rounded-md text-[#2C2C2C]"
          />
        </div>

        {/* Comment */}
        <div className="mb-6">
          <label className="block text-sm mb-2 text-[#2C2C2C]">
            Your Review
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you think about this artwork?"
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-md resize-none text-[#2C2C2C]"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-md border border-gray-300 transition-colors hover:bg-gray-50"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className={`flex-1 px-4 py-3 rounded-md transition-all ${isValid ? 'hover:opacity-90 bg-[#D4AF37] text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            type="button"
            disabled={!isValid}
          >
            Submit Review
          </button>
        </div>
      </div>
    </div>
  );
}
