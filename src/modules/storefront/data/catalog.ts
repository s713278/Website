import type { Store } from '../types'

export const STORES: Store[] = [
  {
    id: 'r1',
    name: 'Green Bowl Kitchen',
    category: 'Healthy · Bowls',
    rating: 4.6,
    etaMins: 28,
    distanceKm: 1.8,
    offer: '40% OFF up to ₹80',
    image: 'linear-gradient(135deg, #059669 0%, #047857 45%, #0f766e 100%)',
    theme: {
      primaryColor: '#10b981',
      accentColor: '#f97316',
      backgroundColor: '#f0fdf4',
      fontFamily: 'Poppins',
    },
    products: [
      { id: 'r1-m1', name: 'Millet Power Bowl', description: 'Foxtail millet, roasted veggies, tahini', price: 249, veg: true, popular: true },
      { id: 'r1-m2', name: 'Grilled Paneer Wrap', description: 'Whole-wheat wrap, mint yogurt', price: 199, veg: true },
      { id: 'r1-m3', name: 'Chicken Peri Bowl', description: 'Herb rice, peri chicken, salsa', price: 289, veg: false, popular: true },
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
      // Space in the family name — exercises the '+' encoding in the Google Fonts URL.
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
      // The dark-mode demo case.
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
