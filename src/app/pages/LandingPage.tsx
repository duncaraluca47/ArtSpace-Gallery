import { Link } from "react-router";
import { Navigation } from "../components/Navigation";
import { useArtworks } from "../context/ArtworksContext";
import { ArrowRight } from "lucide-react";

export function LandingPage() {
  const { artworks } = useArtworks();
  const featuredArtworks = artworks.slice(0, 3);
  
  return (
    <div className="landing-page-bg min-h-screen page-reveal">
      <Navigation />
      
      {/* Hero Section */}
      <section className="mx-auto flex max-w-screen-xl justify-center px-4 py-10 sm:px-8 sm:py-14 lg:justify-end lg:py-16">
        <div className="max-w-2xl text-center lg:max-w-xl lg:text-right fade-up">
          <h1 className="mb-5 text-4xl text-[#2C2C2C] sm:text-6xl lg:text-7xl">
            ArtSpace Gallery
          </h1>
          <p className="mb-3 text-xl text-[#627d9a] sm:text-2xl fade-up fade-up-delay-1">
            Where creativity meets the world
          </p>
          <p className="mb-8 w-full text-base text-[#2C2C2C] sm:text-lg lg:ml-auto lg:w-2/3 fade-up fade-up-delay-2">
            Discover extraordinary artworks from talented artists around the globe. 
            Explore our curated collection of contemporary pieces that inspire and captivate.
          </p>
          <Link
            to="/gallery"
            className="inline-flex items-center gap-2 rounded-md bg-[#D4AF37] px-6 py-3 text-base text-white transition-all hover:opacity-90 sm:px-8 sm:py-4 sm:text-lg motion-button fade-up fade-up-delay-3"
          >
            Browse Gallery
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
      
      {/* Featured Artworks */}
      <section className="mx-auto max-w-screen-xl px-4 py-8 sm:px-8 fade-up fade-up-delay-2">
        <h2 className="mb-8 text-center text-3xl text-[#2C2C2C] sm:text-4xl">
          Featured Artworks
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {featuredArtworks.map((artwork) => (
            <Link
              key={artwork.id}
              to={`/artwork/${artwork.id}`}
              className="group cursor-pointer"
            >
              <div className="motion-card overflow-hidden rounded-lg border border-gray-200 bg-white transition-all">
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={artwork.imageUrl}
                    alt={artwork.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-xl mb-2 text-[#2C2C2C]">
                    {artwork.title}
                  </h3>
                  <p className="text-base mb-3 text-[#627d9a]">
                    {artwork.artist}
                  </p>
                  <p className="text-lg text-[#D4AF37]">
                    ${artwork.price.toLocaleString()}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}