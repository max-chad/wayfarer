// Synthetic demo community used to seed sample reviews. All names are generated.

export const FIRST_NAMES = [
  "Amara", "Liam", "Sofia", "Mateo", "Yuki", "Noah", "Aisha", "Lucas", "Mei", "Oliver", "Chiara", "Ethan", "Zara",
  "Hugo", "Priya", "Jonas", "Leila", "Marco", "Ingrid", "Diego", "Hana", "Felix", "Nadia", "Samuel", "Elif", "Arjun",
  "Clara", "Kwame", "Isla", "Tomás", "Freya", "Rafael", "Ananya", "Emil", "Camila", "Kenji", "Maya", "Luca", "Fatima",
  "Theo", "Anika", "Pablo", "Sienna", "Omar", "Lena", "Jae", "Beatriz", "Finn", "Daria", "Malik", "Astrid", "Gabriel",
  "Rosa", "Hiroshi", "Nora", "Tariq", "Elena", "Mika", "Ada", "Julian", "Imani", "Sven", "Valentina", "Ravi", "Chloe",
  "Nikolai", "Lucia", "Kofi", "Ines", "Aarav", "Greta", "Andrés", "Soo-ah", "Hamza", "Matilda", "Bruno", "Keiko",
  "Owen", "Aylin", "Viktor", "Paloma", "Dev", "Saoirse", "Joaquín", "Lin", "Esme", "Yusuf", "Carmen", "Ben", "Thandi",
  "Pedro", "Noor", "Emma", "Kai", "Farah", "Leo", "Wren", "Dmitri", "Jasmine", "Arlo", "Nia", "Marcel", "Ottilie",
];

export const LAST_NAMES = [
  "Okafor", "Nguyen", "Rossi", "García", "Tanaka", "Müller", "Silva", "Kowalski", "Haddad", "Johansson", "Patel",
  "O'Brien", "Kim", "Dubois", "Mensah", "Novak", "Fischer", "Costa", "Yilmaz", "Andersen", "Moreau", "Sato", "Reyes",
  "Kaur", "Schmidt", "Ferreira", "Petrov", "Lindqvist", "Mbeki", "Alvarez", "Chen", "Brennan", "Castillo", "Hoffmann",
  "Ito", "Bianchi", "Walsh", "Nakamura", "Rahman", "Larsen", "Santos", "Wright", "Popescu", "Horvat", "Ahmed", "Park",
  "Martin", "Lopez", "Taylor", "Evans", "Bauer", "Varga", "Morales", "Clarke", "Tran", "Suzuki", "Jensen", "Romero",
];

export const HOME_CITIES: { name: string; lat: number; lng: number }[] = [
  { name: "London, UK", lat: 51.5072, lng: -0.1276 },
  { name: "Manchester, UK", lat: 53.4808, lng: -2.2426 },
  { name: "Dublin, Ireland", lat: 53.3498, lng: -6.2603 },
  { name: "New York, USA", lat: 40.7128, lng: -74.006 },
  { name: "Chicago, USA", lat: 41.8781, lng: -87.6298 },
  { name: "Austin, USA", lat: 30.2672, lng: -97.7431 },
  { name: "Seattle, USA", lat: 47.6062, lng: -122.3321 },
  { name: "Los Angeles, USA", lat: 34.0522, lng: -118.2437 },
  { name: "Boston, USA", lat: 42.3601, lng: -71.0589 },
  { name: "Toronto, Canada", lat: 43.6532, lng: -79.3832 },
  { name: "Montréal, Canada", lat: 45.5019, lng: -73.5674 },
  { name: "Sydney, Australia", lat: -33.8688, lng: 151.2093 },
  { name: "Melbourne, Australia", lat: -37.8136, lng: 144.9631 },
  { name: "Auckland, New Zealand", lat: -36.8485, lng: 174.7633 },
  { name: "Berlin, Germany", lat: 52.52, lng: 13.405 },
  { name: "Munich, Germany", lat: 48.1351, lng: 11.582 },
  { name: "Hamburg, Germany", lat: 53.5511, lng: 9.9937 },
  { name: "Paris, France", lat: 48.8566, lng: 2.3522 },
  { name: "Lyon, France", lat: 45.764, lng: 4.8357 },
  { name: "Madrid, Spain", lat: 40.4168, lng: -3.7038 },
  { name: "Milan, Italy", lat: 45.4642, lng: 9.19 },
  { name: "Amsterdam, Netherlands", lat: 52.3676, lng: 4.9041 },
  { name: "Stockholm, Sweden", lat: 59.3293, lng: 18.0686 },
  { name: "Copenhagen, Denmark", lat: 55.6761, lng: 12.5683 },
  { name: "Oslo, Norway", lat: 59.9139, lng: 10.7522 },
  { name: "Warsaw, Poland", lat: 52.2297, lng: 21.0122 },
  { name: "Zürich, Switzerland", lat: 47.3769, lng: 8.5417 },
  { name: "Brussels, Belgium", lat: 50.8503, lng: 4.3517 },
  { name: "Lisbon, Portugal", lat: 38.7223, lng: -9.1393 },
  { name: "Athens, Greece", lat: 37.9838, lng: 23.7275 },
  { name: "Istanbul, Türkiye", lat: 41.0082, lng: 28.9784 },
  { name: "Tel Aviv, Israel", lat: 32.0853, lng: 34.7818 },
  { name: "Dubai, UAE", lat: 25.2048, lng: 55.2708 },
  { name: "Mumbai, India", lat: 19.076, lng: 72.8777 },
  { name: "Bengaluru, India", lat: 12.9716, lng: 77.5946 },
  { name: "Singapore", lat: 1.3521, lng: 103.8198 },
  { name: "Tokyo, Japan", lat: 35.6762, lng: 139.6503 },
  { name: "Osaka, Japan", lat: 34.6937, lng: 135.5023 },
  { name: "Seoul, South Korea", lat: 37.5665, lng: 126.978 },
  { name: "Hong Kong", lat: 22.3193, lng: 114.1694 },
  { name: "Shanghai, China", lat: 31.2304, lng: 121.4737 },
  { name: "Manila, Philippines", lat: 14.5995, lng: 120.9842 },
  { name: "Jakarta, Indonesia", lat: -6.2088, lng: 106.8456 },
  { name: "Bangkok, Thailand", lat: 13.7563, lng: 100.5018 },
  { name: "Cape Town, South Africa", lat: -33.9249, lng: 18.4241 },
  { name: "Nairobi, Kenya", lat: -1.2921, lng: 36.8219 },
  { name: "Lagos, Nigeria", lat: 6.5244, lng: 3.3792 },
  { name: "Accra, Ghana", lat: 5.6037, lng: -0.187 },
  { name: "São Paulo, Brazil", lat: -23.5505, lng: -46.6333 },
  { name: "Mexico City, Mexico", lat: 19.4326, lng: -99.1332 },
  { name: "Bogotá, Colombia", lat: 4.711, lng: -74.0721 },
  { name: "Santiago, Chile", lat: -33.4489, lng: -70.6693 },
  { name: "Buenos Aires, Argentina", lat: -34.6037, lng: -58.3816 },
  { name: "Vancouver, Canada", lat: 49.2827, lng: -123.1207 },
  { name: "Denver, USA", lat: 39.7392, lng: -104.9903 },
  { name: "Miami, USA", lat: 25.7617, lng: -80.1918 },
];

export const BIOS = [
  "Chasing good coffee and quiet mornings in new cities.",
  "Weekend-warrior traveler. Always hunting for the best local food.",
  "Slow traveler, museum lover, occasional hiker.",
  "Family of four exploring the world one school holiday at a time.",
  "Architecture nerd. Will walk 25,000 steps for a good view.",
  "Street food first, fine dining second, sleep third.",
  "Solo traveler writing honest reviews since forever.",
  "Business trips by day, night markets by night.",
  "Photographer who plans trips around golden hour.",
  "Retired teacher ticking off my bucket list.",
  "Budget backpacker turned boutique-hotel convert.",
  "Wine, history and long lunches.",
  "Hiker, kayaker, snorkeler — outdoors whenever possible.",
  "Honeymooners collecting sunsets.",
  "Food writer at heart. I rate honestly and specifically.",
  "",
  "",
];

export const STAFF_NAMES = [
  "Marco", "Sofia", "Ahmed", "Yuki", "Lena", "Carlos", "Ines", "Tom", "Priya", "Jonas", "Amina", "Luca", "Mei",
  "Pedro", "Hana", "Omar", "Elena", "Kofi", "Nina", "Rafael", "Sara", "Daniel", "Aiko", "Mateus", "Leila",
];

export const COMPANIONS: Record<string, string[]> = {
  couples: ["my partner", "my wife", "my husband", "my girlfriend", "my boyfriend", "my fiancée"],
  family: ["the kids", "our children", "my parents", "the whole family", "our two teenagers", "my mum"],
  friends: ["my friends", "a group of friends", "my best friend", "my old uni mates", "my travel buddy"],
  solo: ["me", "myself", "a solo traveler like me"],
  business: ["my colleague", "my team", "a client", "my manager"],
};

export const OWNER_RESPONSES = {
  positive: [
    "Dear guest, thank you so much for your wonderful words! It was a pleasure having you and we hope to welcome you back soon. Warm regards, {staff}, Guest Relations",
    "Thank you for taking the time to share your experience. We're delighted you enjoyed your visit and will pass your kind words on to the whole team. — {staff}",
    "What a lovely review to read! We are thrilled that {place} made your stay in {city} special. See you next time! — {staff}, Manager",
  ],
  mixed: [
    "Thank you for your honest feedback. We're glad you enjoyed several aspects of your visit and we've shared your comments with the team so we can improve. — {staff}",
    "We appreciate you taking the time to write this review. Your suggestions are genuinely useful and we're already looking at how to do better. Kind regards, {staff}",
  ],
  negative: [
    "We're truly sorry to hear your experience did not meet expectations. This is not the standard we aim for at {place}. Please contact us directly so we can make this right. — {staff}, General Manager",
    "Thank you for your feedback, and our sincere apologies. We have reviewed the issues you raised with our team and taken concrete steps to address them. We hope you'll give us another chance. — {staff}",
    "We regret that your visit was disappointing. Your comments have been passed to our management team and we are working hard on improvements. — {staff}",
  ],
};
