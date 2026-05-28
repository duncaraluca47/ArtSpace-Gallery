export type Artwork = {
  id: string;
  title: string;
  artist: string;
  year: number;
  price: number;
  category: string;
  description: string;
  imageUrl: string;
  likes: number;
  reviews: Review[];
};

export type Review = {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
};

export type ArtworkCreateInput = Omit<Artwork, "id" | "likes" | "reviews"> & {
  id?: string;
  likes?: number;
  reviews?: Review[];
};

export type ArtworkUpdateInput = Partial<ArtworkCreateInput>;

export type ArtworkListQuery = {
  page: number;
  pageSize: number;
  artist?: string;
  category?: string;
  search?: string;
};

export type ArtworkListResponse = {
  items: Artwork[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export type ArtworksStats = {
  totalArtworks: number;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  categoryDistribution: Array<{
    category: string;
    count: number;
  }>;
  totalReviews?: number;
  averageRating?: number;
};
