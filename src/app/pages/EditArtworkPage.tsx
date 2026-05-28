import { useParams, useNavigate, Link } from "react-router";
import { useEffect, useState } from "react";
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

export function EditArtworkPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { artworks, updateArtwork } = useArtworks();
  const artwork = artworks.find((a) => a.id === id);
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

  useEffect(() => {
    if (!artwork) {
      return;
    }

    setValues({
      title: artwork.title,
      artist: artwork.artist,
      year: String(artwork.year),
      price: String(artwork.price),
      category: artwork.category,
      description: artwork.description,
      imageUrl: artwork.imageUrl,
    });
  }, [artwork]);

  const handleChange =
    (field: keyof ArtworkFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  
  if (!artwork) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="max-w-screen-xl mx-auto px-8 py-24 text-center">
          <h1 className="text-3xl mb-4 text-[#2C2C2C]">
            Artwork not found
          </h1>
          <Link to="/gallery" className="text-[#D4AF37]">
            Return to Gallery
          </Link>
        </div>
      </div>
    );
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) {
      return;
    }

    const validationErrors = validateArtworkForm(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    updateArtwork(id, toArtworkDraft(values));
    trackAction("artwork_updated");
    navigate(`/artwork/${id}`);
  };
  
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      <div className="max-w-3xl mx-auto px-8 py-12">
        <Link
          to={`/artwork/${id}`}
          className="inline-flex items-center gap-2 mb-8 transition-colors text-[#666666]"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Artwork
        </Link>
        
        <h1 className="text-4xl mb-8 text-[#2C2C2C]">
          Edit Artwork
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
                value={values.description}
                onChange={handleChange("description")}
                rows={5}
                className="w-full border-gray-300 focus:border-[#D4AF37] focus:ring-[#D4AF37]"
                required
              />
              {errors.description && <p className="text-sm text-red-600 mt-1">{errors.description}</p>}
            </div>
            
            <div>
              <Label htmlFor="imageUrl" className="text-base mb-2 block text-[#2C2C2C]">
                Artwork Image URL
              </Label>
              <div className="mb-4">
                <img
                  src={values.imageUrl || artwork.imageUrl}
                  alt={artwork.title}
                  className="w-full h-64 object-cover rounded-lg"
                />
              </div>
              <Input
                id="imageUrl"
                type="url"
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
              Save Changes
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
