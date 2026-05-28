export interface Artwork {
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
}

export interface Review {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

export const artworks: Artwork[] = [
  {
    id: "1",
    title: "Abstract Emotions",
    artist: "Sarah Martinez",
    year: 2024,
    price: 12500,
    category: "Abstract",
    description: "A vibrant exploration of human emotions through abstract forms and bold colors. This piece captures the complexity of feelings in a modern interpretation.",
    imageUrl: "https://ik.imagekit.io/theartling/prod/tr:w-1650/products/Product/065d0e64a3514880bf2398126d0bcdca_sw-3815_sh-2501.jpg",
    likes: 142,
    reviews: [
      { id: "r1", userName: "Art Lover", rating: 5, comment: "Absolutely stunning!", date: "2024-03-10" },
      { id: "r2", userName: "John D.", rating: 4, comment: "Beautiful colors and composition.", date: "2024-03-12" },
    ],
  },
  {
    id: "2",
    title: "Contemporary Forms",
    artist: "James Chen",
    year: 2023,
    price: 28000,
    category: "Sculpture",
    description: "A striking contemporary sculpture that challenges traditional forms and invites viewers to explore space and dimension in new ways.",
    imageUrl: "https://res.cloudinary.com/jerrick/image/upload/c_scale,f_jpg,q_auto/64b332d3142c45001d5b0eef.jpg",
    likes: 89,
    reviews: [
      { id: "r3", userName: "Modern Art Fan", rating: 5, comment: "Incredible work!", date: "2024-03-08" },
      { id: "r4", userName: "Lisa M.", rating: 5, comment: "Worth every penny.", date: "2024-03-11" },
      { id: "r5", userName: "Mike P.", rating: 4, comment: "Very impressive.", date: "2024-03-14" },
    ],
  },
  {
    id: "3",
    title: "Vibrant Expressions",
    artist: "Maria Garcia",
    year: 2025,
    price: 15800,
    category: "Contemporary",
    description: "This piece bursts with energy and life, using a bold palette to create a sense of movement and joy that resonates with viewers.",
    imageUrl: "https://www.thisiscolossal.com/wp-content/uploads/2016/03/finger-1.jpg",
    likes: 234,
    reviews: [
      { id: "r6", userName: "Sarah W.", rating: 5, comment: "So vibrant and full of life!", date: "2024-03-09" },
    ],
  },
  {
    id: "4",
    title: "Minimalist Study",
    artist: "David Kim",
    year: 2024,
    price: 8900,
    category: "Minimalist",
    description: "An exercise in restraint and precision, this minimalist work demonstrates the power of simplicity and negative space.",
    imageUrl: "https://www.brianparkerartist.co.uk/wp-content/uploads/2023/07/Time-to-Rise-Brian-Parker-Artist.jpg",
    likes: 67,
    reviews: [
      { id: "r7", userName: "Minimalist Enthusiast", rating: 3, comment: "Nice, but too simple for the price.", date: "2024-03-07" },
      { id: "r8", userName: "Alex R.", rating: 4, comment: "Perfect for my office.", date: "2024-03-13" },
    ],
  },
  {
    id: "5",
    title: "Emotional Landscape",
    artist: "Emma Wilson",
    year: 2023,
    price: 19200,
    category: "Expressionist",
    description: "A powerful expressionist piece that transforms emotional experience into a visual landscape of color and texture.",
    imageUrl: "https://i.redd.it/m90zmrpzewe81.jpg",
    likes: 178,
    reviews: [
      { id: "r9", userName: "Emily K.", rating: 5, comment: "This speaks to my soul.", date: "2024-03-06" },
      { id: "r10", userName: "Robert L.", rating: 5, comment: "A masterpiece!", date: "2024-03-15" },
      { id: "r11", userName: "Anna S.", rating: 4, comment: "Very emotional and powerful.", date: "2024-03-16" },
    ],
  },
  {
    id: "6",
    title: "Watercolor Dreams",
    artist: "Sarah Martinez",
    year: 2025,
    price: 11400,
    category: "Watercolor",
    description: "Delicate watercolor techniques create an ethereal dreamscape that invites contemplation and wonder.",
    imageUrl: "https://www.artistsandillustrators.co.uk/wp-content/uploads/2024/06/8-1-778x1024.jpg",
    likes: 201,
    reviews: [
      { id: "r12", userName: "Dream Collector", rating: 5, comment: "Ethereal and beautiful!", date: "2024-03-05" },
      { id: "r13", userName: "Tom H.", rating: 4, comment: "Lovely watercolor work.", date: "2024-03-17" },
    ],
  },
  {
    id: "7",
    title: "Waiting for the Tide",
    artist: "Gavin Mundy",
    year: 2024,
    price: 16000,
    category: "Acrylic",
    description: "Delicate watercolor techniques create an ethereal dreamscape that invites contemplation and wonder.",
    imageUrl: "https://www.artistsandillustrators.co.uk/wp-content/uploads/2024/04/97E92415-D631-4AEC-85B4-C969790E5EF8_1_201_a-1024x728.jpeg",
    likes: 95,
    reviews: [
      { id: "r14", userName: "Beach Lover", rating: 4, comment: "Captures the moment perfectly.", date: "2024-03-04" },
    ],
  },
];