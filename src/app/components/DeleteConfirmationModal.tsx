import { X, AlertTriangle } from "lucide-react";
import type { Artwork } from "../data/artworks";

interface DeleteConfirmationModalProps {
  artwork: Artwork;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmationModal({
  artwork,
  isOpen,
  onClose,
  onConfirm,
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-red-50 border-red-300">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#DC2626]">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl text-[#2C2C2C]">
              Delete Artwork
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-[#666666]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-lg mb-6 text-[#2C2C2C]">
            Are you sure you want to permanently delete this artwork? This action
            cannot be undone.
          </p>

          {/* Artwork Preview */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex gap-4">
              <img
                src={artwork.imageUrl}
                alt={artwork.title}
                className="w-32 h-32 object-cover rounded"
              />
              <div className="flex-1">
                <h3 className="text-xl mb-2 text-[#2C2C2C]">
                  {artwork.title}
                </h3>
                <p className="text-base mb-1 text-[#666666]">
                  <strong>Artist:</strong> {artwork.artist}
                </p>
                <p className="text-base mb-1 text-[#666666]">
                  <strong>Year:</strong> {artwork.year}
                </p>
                <p className="text-base text-[#D4AF37]">
                  <strong>Price:</strong> ${artwork.price.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="flex items-start gap-3 p-4 rounded-lg mb-6 bg-red-50">
            <AlertTriangle
              className="w-5 h-5 mt-0.5 flex-shrink-0 text-[#DC2626]"
            />
            <div>
              <p className="text-sm text-[#2C2C2C]">
                <strong>Warning:</strong> Deleting this artwork will:
              </p>
              <ul className="text-sm mt-2 space-y-1 text-[#666666]">
                <li>• Remove it from the gallery permanently</li>
                <li>• Delete all associated images and metadata</li>
                <li>• This action is irreversible</li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-md border border-[#E5E5E5] text-[#2C2C2C] transition-all hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-6 py-3 rounded-md transition-all hover:opacity-90 flex items-center gap-2 bg-[#DC2626] text-white"
            >
              <AlertTriangle className="w-5 h-5" />
              Delete Permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
