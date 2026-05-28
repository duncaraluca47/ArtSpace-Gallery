import { useNavigate, Link } from "react-router";
import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { useArtworks } from "../context/ArtworksContext";
import {
  toArtworkDraft,
  validateArtworkForm,
  type ArtworkFormValues,
} from "../validation/forms";
import { trackAction } from "../monitoring/activityMonitor";

export function AddArtworkPage() {
  const navigate = useNavigate();
  const { addArtwork } = useArtworks();
  const [values, setValues] = useState<ArtworkFormValues>({
    title: "",
    artist: "",
    year: "",
    price: "",
    category: "",
    description: "",
    imageUrl: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ArtworkFormValues, string>>>({});

  const handleChange =
    (field: keyof ArtworkFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateArtworkForm(values);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const createdArtwork = addArtwork(toArtworkDraft(values));
    trackAction("artwork_created");
    navigate(`/artwork/${createdArtwork.id}`);
  };
  
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      <div className="max-w-3xl mx-auto px-8 py-12">
        <Link
          to="/gallery"
          className="inline-flex items-center gap-2 mb-8 transition-colors text-[#666666]"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Gallery
        </Link>
        
        <h1 className="text-4xl mb-8 text-[#2C2C2C]">
          Add New Artwork
        </h1>
        
        <div className="bg-white border border-gray-200 rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label htmlFor="title" className="text-base mb-2 block text-[#2C2C2C]">
                  Title
                </Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="Artwork title"
                  value={values.title}
                  onChange={handleChange("title")}
                  className="w-full border-gray-300 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                  required
                />
                {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title}</p>}
              </div>
              
              <div>
                <Label htmlFor="artist" className="text-base mb-2 block text-[#2C2C2C]">
                  Artist
                </Label>
                <Input
                  id="artist"
                  type="text"
                  placeholder="Artist name"
                  value={values.artist}
                  onChange={handleChange("artist")}
                  className="w-full border-gray-300 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                  required
                />
                {errors.artist && <p className="text-sm text-red-600 mt-1">{errors.artist}</p>}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label htmlFor="year" className="text-base mb-2 block text-[#2C2C2C]">
                  Year
                </Label>
                <Input
                  id="year"
                  type="number"
                  placeholder="2024"
                  value={values.year}
                  onChange={handleChange("year")}
                  className="w-full border-gray-300 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                  required
                />
                {errors.year && <p className="text-sm text-red-600 mt-1">{errors.year}</p>}
              </div>
              
              <div>
                <Label htmlFor="price" className="text-base mb-2 block text-[#2C2C2C]">
                  Price
                </Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="10000"
                  value={values.price}
                  onChange={handleChange("price")}
                  className="w-full border-gray-300 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                  required
                />
                {errors.price && <p className="text-sm text-red-600 mt-1">{errors.price}</p>}
              </div>
            </div>
            
            <div>
              <Label htmlFor="category" className="text-base mb-2 block text-[#2C2C2C]">
                Category
              </Label>
              <Input
                id="category"
                type="text"
                placeholder="e.g., Abstract, Contemporary, Minimalist"
                value={values.category}
                onChange={handleChange("category")}
                className="w-full border-gray-300 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                required
              />
              {errors.category && <p className="text-sm text-red-600 mt-1">{errors.category}</p>}
            </div>
            
            <div>
              <Label htmlFor="description" className="text-base mb-2 block text-[#2C2C2C]">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Describe the artwork..."
                rows={5}
                value={values.description}
                onChange={handleChange("description")}
                className="w-full border-gray-300 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                required
              />
              {errors.description && <p className="text-sm text-red-600 mt-1">{errors.description}</p>}
            </div>
            
            <div>
              <Label htmlFor="imageUrl" className="text-base mb-2 block text-[#2C2C2C]">
                Artwork Image URL
              </Label>
              <Input
                id="imageUrl"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={values.imageUrl}
                onChange={handleChange("imageUrl")}
                className="w-full border-gray-300 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                required
              />
              {errors.imageUrl && <p className="text-sm text-red-600 mt-1">{errors.imageUrl}</p>}
            </div>
            
            <button
              type="submit"
              className="w-full py-3 rounded-md text-base transition-all hover:opacity-90 bg-[#D4AF37] text-white"
            >
              Save Artwork
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
