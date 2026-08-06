import type {
  BusinessType,
  CategoryOption,
  OnboardingStepMeta,
  ThemePreset,
} from '@/features/onboarding/types';

export const ONBOARDING_STEPS: OnboardingStepMeta[] = [
  { n: 1, label: 'Verify Mobile', time: '1 min' },
  { n: 2, label: 'Enter OTP', time: '1 min' },
  { n: 3, label: 'Choose Business', time: '1 min' },
  { n: 4, label: 'Pick Categories', time: '1 min' },
  { n: 5, label: 'Add Products', time: '3 min' },
  { n: 6, label: 'Set Prices', time: '2 min' },
  { n: 7, label: 'Delivery', time: '1 min' },
  { n: 8, label: 'Payments', time: '1 min' },
  { n: 9, label: 'Store Settings', time: '1 min' },
  { n: 10, label: "You're Live", time: '1 min' },
];

export const TOTAL_STEPS = ONBOARDING_STEPS.length;

export const BUSINESS_TYPES: BusinessType[] = [
  { id: 'home-kitchen', label: 'Home Kitchen', icon: '🏠', keywords: 'home cooked meals tiffin catering food' },
  { id: 'pickles', label: 'Pickles & Homemade', icon: '🫙', keywords: 'pickle achar podi chutney homemade' },
  { id: 'bakery', label: 'Bakery', icon: '🥐', keywords: 'cake bread pastry cookies bakery' },
  { id: 'spices', label: 'Spices & Masalas', icon: '🌶️', keywords: 'spice masala powder seasonings' },
  { id: 'snacks', label: 'Snacks & Sweets', icon: '🍬', keywords: 'snacks sweets namkeen mithai' },
  { id: 'dairy', label: 'Dairy & Fresh', icon: '🥛', keywords: 'milk curd paneer ghee dairy' },
  { id: 'organic', label: 'Organic Produce', icon: '🥬', keywords: 'organic vegetables fruits farm' },
  { id: 'crafts', label: 'Handmade Crafts', icon: '🧵', keywords: 'craft handmade decor gifts art' },
  { id: 'florist', label: 'Florist & Plants', icon: '🌸', keywords: 'flowers plants bouquet nursery' },
  { id: 'clothing', label: 'Clothing & Apparel', icon: '👗', keywords: 'clothes fashion boutique garments' },
  { id: 'jewellery', label: 'Jewellery', icon: '💍', keywords: 'jewellery jewelry ornaments gold silver' },
  { id: 'beauty', label: 'Beauty & Wellness', icon: '💅', keywords: 'beauty salon spa cosmetics wellness' },
  { id: 'stationery', label: 'Stationery & Books', icon: '📚', keywords: 'books stationery gifts office' },
  { id: 'electronics', label: 'Electronics', icon: '🔌', keywords: 'electronics mobiles accessories gadgets' },
  { id: 'pets', label: 'Pet Supplies', icon: '🐾', keywords: 'pets dogs cats food accessories' },
  { id: 'grocery', label: 'Grocery & Kirana', icon: '🛒', keywords: 'grocery kirana provisions staples' },
  { id: 'meat', label: 'Meat & Seafood', icon: '🐟', keywords: 'meat chicken fish seafood' },
  { id: 'others', label: 'Others', icon: '✨', keywords: 'other custom general miscellaneous any business' },
];

export const BUSINESS_TYPE_PAGE_SIZE = 9;

export const CATEGORY_CATALOG: Record<string, CategoryOption[]> = {
  'home-kitchen': [
    { id: 'meals', name: 'Meals' },
    { id: 'snacks', name: 'Snacks' },
    { id: 'sweets', name: 'Sweets' },
  ],
  pickles: [
    { id: 'pickles', name: 'Pickles' },
    { id: 'combo-packs', name: 'Combo Packs' },
    { id: 'powders', name: 'Powders' },
    { id: 'chutneys', name: 'Chutneys' },
  ],
  bakery: [
    { id: 'breads', name: 'Breads' },
    { id: 'cakes', name: 'Cakes' },
    { id: 'cookies', name: 'Cookies' },
  ],
  spices: [
    { id: 'masalas', name: 'Masalas' },
    { id: 'whole-spices', name: 'Whole Spices' },
  ],
  snacks: [
    { id: 'savory', name: 'Savory' },
    { id: 'sweets', name: 'Sweets' },
  ],
  dairy: [
    { id: 'milk', name: 'Milk Products' },
    { id: 'curd', name: 'Curd & Paneer' },
  ],
  organic: [
    { id: 'veggies', name: 'Vegetables' },
    { id: 'fruits', name: 'Fruits' },
  ],
  crafts: [
    { id: 'decor', name: 'Home Decor' },
    { id: 'gifts', name: 'Gift Items' },
  ],
  florist: [
    { id: 'bouquets', name: 'Bouquets' },
    { id: 'plants', name: 'Plants' },
  ],
  clothing: [
    { id: 'women', name: 'Women' },
    { id: 'men', name: 'Men' },
  ],
  jewellery: [
    { id: 'earrings', name: 'Earrings' },
    { id: 'necklaces', name: 'Necklaces' },
  ],
  beauty: [
    { id: 'skincare', name: 'Skincare' },
    { id: 'makeup', name: 'Makeup' },
  ],
  stationery: [
    { id: 'notebooks', name: 'Notebooks' },
    { id: 'gifts', name: 'Gift Sets' },
  ],
  electronics: [
    { id: 'accessories', name: 'Accessories' },
    { id: 'gadgets', name: 'Gadgets' },
  ],
  pets: [
    { id: 'pet-food', name: 'Pet Food' },
    { id: 'pet-care', name: 'Pet Care' },
  ],
  grocery: [
    { id: 'staples', name: 'Staples' },
    { id: 'daily', name: 'Daily Needs' },
  ],
  meat: [
    { id: 'chicken', name: 'Chicken' },
    { id: 'seafood', name: 'Seafood' },
  ],
  others: [
    { id: 'general', name: 'General' },
    { id: 'bestsellers', name: 'Bestsellers' },
    { id: 'new-arrivals', name: 'New Arrivals' },
  ],
};

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'emerald', label: 'Emerald', color: '#10b981' },
  { id: 'teal', label: 'Teal', color: '#0d9488' },
  { id: 'amber', label: 'Amber', color: '#d97706' },
  { id: 'rose', label: 'Rose', color: '#e11d48' },
  { id: 'sky', label: 'Sky', color: '#0284c8' },
  { id: 'forest', label: 'Forest', color: '#166534' },
];

export const PRODUCT_COLORS = ['#FEF3C7', '#FECACA', '#D1FAE5', '#DBEAFE', '#E9D5FF', '#FFEDD5'];

export const FREE_PLAN_FEATURES = [
  { code: 'storefront', label: 'Live storefront', icon: '🏪' },
  { code: 'whatsapp_orders', label: 'WhatsApp orders', icon: '💬' },
  { code: 'products', label: 'Product catalog', icon: '📦' },
  { code: 'delivery', label: 'Delivery options', icon: '🚚' },
  { code: 'payments', label: 'UPI / COD payments', icon: '💳' },
  { code: 'branding', label: 'Theme & branding', icon: '🎨' },
] as const;

export function categoriesForBusiness(businessTypeId: string): CategoryOption[] {
  return (CATEGORY_CATALOG[businessTypeId] || []).map((c) => ({ ...c }));
}

export function slugify(text: string): string {
  return (
    String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'my-store'
  );
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
