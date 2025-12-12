// Character configuration for Flappy Cakes
export interface Character {
  id: string;
  name: string;
  sprite: string; // Path to sprite image in /public
  color: string; // Primary color for UI display
  description: string;
}

export const CHARACTERS: Character[] = [
  {
    id: 'cupcake',
    name: 'Cupcake',
    sprite: '/characters/cupcake.png',
    color: '#FFB6C1', // Light pink
    description: 'Sweet and fluffy!'
  },
  {
    id: 'donut',
    name: 'Donut',
    sprite: '/characters/donut.png',
    color: '#DEB887', // Burlywood
    description: 'Glazed to perfection!'
  },
  {
    id: 'cookie',
    name: 'Cookie',
    sprite: '/characters/cookie.png',
    color: '#D2691E', // Chocolate
    description: 'Crispy and delicious!'
  },
  {
    id: 'macaron',
    name: 'Macaron',
    sprite: '/characters/macaron.png',
    color: '#E6E6FA', // Lavender
    description: 'Fancy French treat!'
  },
  {
    id: 'cake-slice',
    name: 'Cake Slice',
    sprite: '/characters/cake-slice.png',
    color: '#FF69B4', // Hot pink
    description: 'A piece of heaven!'
  },
  {
    id: 'ice-cream',
    name: 'Ice Cream',
    sprite: '/characters/ice-cream.png',
    color: '#98FF98', // Mint green
    description: 'Cool and creamy!'
  }
];

// Default character
export const DEFAULT_CHARACTER = CHARACTERS[0];

// Helper function to get character by ID
export function getCharacterById(id: string): Character {
  return CHARACTERS.find(c => c.id === id) || DEFAULT_CHARACTER;
}
