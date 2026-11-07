import type { ProductVariant, Store } from '../types'

function demoSku(id: string, unit: string, price: number): ProductVariant {
  return { id, unit, price, onSale: false, skuType: 'ITEM' }
}

const DEMO_IMAGES = {
  mango: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&h=600&q=85',
  garlic: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&h=600&q=85',
  prawn: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=600&h=600&q=85',
  lemon: 'https://images.unsplash.com/photo-1615485290381-441e4d049735?auto=format&fit=crop&w=600&h=600&q=85',
  gongura: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&h=600&q=85',
  chicken: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=600&h=600&q=85',
  combo: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=600&h=600&q=85',
  spices: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&h=600&q=85',
} as const

const ANITHA_HERO =
  'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=1600&h=900&q=90'

/** Demo catalog — r1 is the reference Anitha storefront UI. */
export const STORES: Store[] = [
  {
    id: 'r1',
    name: 'Anitha Homemade Pickles',
    tagline: 'Traditional · Natural · Homemade',
    category: 'Traditional · Natural · Homemade',
    rating: 4.8,
    etaMins: 45,
    distanceKm: 2.1,
    offer: '100% HOMEMADE',
    image: 'linear-gradient(135deg, #0b3d2e 0%, #14532d 45%, #166534 100%)',
    heroImage: ANITHA_HERO,
    theme: {
      primaryColor: '#10b981',
      accentColor: '#f59e0b',
      backgroundColor: '#f8fafc',
      fontFamily: 'Poppins',
    },
    categories: [
      { label: 'Mango Pickles', imagePath: DEMO_IMAGES.mango },
      { label: 'Bestsellers', imagePath: DEMO_IMAGES.spices },
      { label: 'Chicken Pickles', imagePath: DEMO_IMAGES.chicken },
      { label: 'Seafood Pickles', imagePath: DEMO_IMAGES.prawn },
      { label: 'Veg Pickles', imagePath: DEMO_IMAGES.garlic },
      { label: 'Combo Offers', imagePath: DEMO_IMAGES.combo },
      { label: 'Spice Mix', imagePath: DEMO_IMAGES.spices },
      { label: 'Gift Packs', imagePath: DEMO_IMAGES.lemon },
    ],
    products: [
      {
        id: 'r1-m1',
        name: 'Avakaya Mango Special',
        description:
          'Our signature Andhra-style mango pickle is made in small batches with raw mangoes, cold-pressed oil, and a family spice blend. Perfect with rice, curd rice, or parathas.',
        price: 199,
        veg: true,
        popular: true,
        category: 'Mango Pickles',
        imageUrl: DEMO_IMAGES.mango,
        images: [DEMO_IMAGES.mango, DEMO_IMAGES.spices, DEMO_IMAGES.lemon, DEMO_IMAGES.gongura],
        rating: 4.6,
        reviewCount: 120,
        spiceLevel: 'Mild Spicy',
        ingredients: 'Raw mango, mustard powder, red chilli, fenugreek, turmeric, salt, sesame oil',
        variants: [
          demoSku('250g', '250 g', 119),
          demoSku('500g', '500 g', 199),
          demoSku('1kg', '1 kg', 349),
        ],
      },
      {
        id: 'r1-m2',
        name: 'Bestseller Combo Jar',
        description:
          'A customer favourite mix of our top pickles in one jar — great for everyday meals and gifting. Balanced spice, ready to serve.',
        price: 249,
        veg: true,
        popular: true,
        category: 'Bestsellers',
        imageUrl: DEMO_IMAGES.spices,
        rating: 4.8,
        reviewCount: 86,
        spiceLevel: 'Medium Spicy',
        ingredients: 'Mixed vegetables, mango, lemon, mustard, chilli, fenugreek, salt, oil',
        variants: [
          demoSku('500g', '500 g', 249),
          demoSku('750g', '750 g', 349),
        ],
      },
      {
        id: 'r1-m3',
        name: 'Spicy Chicken Pickle',
        description:
          'Tender chicken pieces slow-cooked in a traditional Andhra masala with garlic, chilli, and aromatic spices. Rich, bold flavour — pairs well with rice, roti, or as a side.',
        price: 329,
        veg: false,
        popular: true,
        category: 'Chicken Pickles',
        imageUrl: DEMO_IMAGES.chicken,
        rating: 4.7,
        reviewCount: 94,
        spiceLevel: 'Medium Spicy',
        ingredients: 'Chicken, garlic, red chilli, mustard, fenugreek, turmeric, salt, sesame oil',
        variants: [
          demoSku('400g', '400 g', 329),
          demoSku('750g', '750 g', 549),
        ],
      },
      {
        id: 'r1-m4',
        name: 'Coastal Prawn Pickle',
        description:
          'Fresh prawns marinated in pepper-garlic masala — a coastal Andhra speciality with a savoury, tangy finish.',
        price: 349,
        veg: false,
        popular: true,
        category: 'Seafood Pickles',
        imageUrl: DEMO_IMAGES.prawn,
        rating: 4.7,
        reviewCount: 72,
        spiceLevel: 'Medium Spicy',
        ingredients: 'Prawns, pepper, garlic, chilli, mustard, salt, oil',
        unit: '400 g',
      },
      {
        id: 'r1-m5',
        name: 'Garlic Pickle',
        description:
          'Whole garlic cloves pickled in a fiery masala — strong, punchy flavour for garlic lovers.',
        price: 179,
        veg: true,
        category: 'Veg Pickles',
        imageUrl: DEMO_IMAGES.garlic,
        rating: 4.5,
        reviewCount: 58,
        spiceLevel: 'Hot',
        ingredients: 'Garlic, red chilli, mustard, fenugreek, turmeric, salt, oil',
        variants: [
          demoSku('250g', '250 g', 99),
          demoSku('500g', '500 g', 179),
        ],
      },
      {
        id: 'r1-m6',
        name: 'Lemon Pickle',
        description:
          'Tangy lemon pieces with green chilli and spices — light, zesty, and perfect with curd rice.',
        price: 159,
        veg: true,
        category: 'Veg Pickles',
        imageUrl: DEMO_IMAGES.lemon,
        rating: 4.3,
        reviewCount: 41,
        spiceLevel: 'Mild Spicy',
        ingredients: 'Lemon, green chilli, mustard, fenugreek, turmeric, salt, oil',
        unit: '500 g',
      },
      {
        id: 'r1-m7',
        name: 'Gongura Pickle',
        description:
          'Classic Andhra gongura (sorrel leaves) pickle — tangy, earthy, and a regional favourite.',
        price: 189,
        veg: true,
        category: 'Veg Pickles',
        imageUrl: DEMO_IMAGES.gongura,
        rating: 4.4,
        reviewCount: 63,
        spiceLevel: 'Mild Spicy',
        ingredients: 'Gongura leaves, chilli, mustard, fenugreek, turmeric, salt, oil',
        unit: '500 g',
      },
      {
        id: 'r1-m8',
        name: 'Family Combo Pack',
        description:
          'Three best-selling jars in one pack — mango, lemon, and garlic. Ideal for families or festive gifting.',
        price: 499,
        veg: true,
        popular: true,
        category: 'Combo Offers',
        imageUrl: DEMO_IMAGES.combo,
        rating: 4.9,
        reviewCount: 112,
        spiceLevel: 'Mild Spicy',
        ingredients: 'Mango, lemon, garlic, mustard, chilli, fenugreek, salt, oil',
        variants: [
          demoSku('3x500g', '3 × 500 g', 499),
          demoSku('5x500g', '5 × 500 g', 799),
        ],
      },
    ],
  },
  {
    id: 'r2',
    name: 'Spice Route Express',
    category: 'North Indian · Thali',
    rating: 4.4,
    etaMins: 35,
    distanceKm: 2.4,
    offer: 'Free delivery',
    image: 'linear-gradient(135deg, #b45309 0%, #c2410c 50%, #9a3412 100%)',
    theme: {
      primaryColor: '#d97706',
      accentColor: '#e11d48',
      backgroundColor: '#faf6f1',
      fontFamily: 'Lora',
    },
    products: [
      { id: 'r2-m1', name: 'Dal Makhani Thali', description: 'Dal, rice, 2 rotis, salad, sweet', price: 279, veg: true, popular: true },
      { id: 'r2-m2', name: 'Butter Chicken', description: 'Classic gravy with naan option', price: 329, veg: false },
      { id: 'r2-m3', name: 'Paneer Tikka', description: 'Tandoor-grilled cottage cheese', price: 259, veg: true },
    ],
  },
  {
    id: 'r3',
    name: 'Coastal Catch',
    category: 'Seafood · South',
    rating: 4.7,
    etaMins: 40,
    distanceKm: 3.1,
    image: 'linear-gradient(135deg, #0369a1 0%, #0e7490 55%, #155e75 100%)',
    theme: {
      primaryColor: '#0284c8',
      accentColor: '#0ea5e9',
      backgroundColor: '#ffffff',
      fontFamily: 'DM Sans',
    },
    products: [
      { id: 'r3-m1', name: 'Fish Curry Meal', description: 'Seer fish curry, steamed rice', price: 349, veg: false, popular: true },
      { id: 'r3-m2', name: 'Prawn Roast', description: 'Pepper-garlic prawns', price: 399, veg: false },
      { id: 'r3-m3', name: 'Veg Stew & Appam', description: 'Coconut stew with appams', price: 229, veg: true },
    ],
  },
  {
    id: 'r4',
    name: 'Night Owl Burgers',
    category: 'Burgers · Late night',
    rating: 4.2,
    etaMins: 22,
    distanceKm: 1.2,
    offer: 'Buy 1 Get 1 on sides',
    image: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #0f172a 100%)',
    theme: {
      primaryColor: '#166534',
      accentColor: '#7c3aed',
      backgroundColor: '#111827',
      fontFamily: 'Outfit',
    },
    products: [
      { id: 'r4-m1', name: 'Classic Smash Burger', description: 'Double patty, cheddar, sauce', price: 269, veg: false, popular: true },
      { id: 'r4-m2', name: 'Crispy Paneer Burger', description: 'Spiced paneer, slaw, mayo', price: 229, veg: true },
      { id: 'r4-m3', name: 'Loaded Fries', description: 'Cheese, jalapeños, herbs', price: 149, veg: true },
    ],
  },
]

export function getStoreById(id: string) {
  return STORES.find((store) => store.id === id)
}
