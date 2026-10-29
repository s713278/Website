/**
 * Sample taglines for the Store Settings "Examples" dialog (Step 9).
 *
 * Frontend-owned copy: `GET /v1/business-types/` returns only id, type, icon and
 * display order, so the backend has nothing to supply here. Groups and wording follow
 * design-reference/assets/js/store-draft.js. A vendor may use any group's sample;
 * `keywords` only picks which group opens first.
 */
export type TaglineExampleGroup = {
  id: string
  label: string
  icon: string
  keywords: string[]
  taglines: [string, string, string]
}

export const TAGLINE_EXAMPLE_GROUPS: TaglineExampleGroup[] = [
  {
    id: 'home-kitchen',
    label: 'Home Kitchen',
    icon: '🏠',
    keywords: ['home kitchen', 'tiffin', 'breakfast', 'catering'],
    taglines: ['Homely Food, Pure Taste', 'Fresh home-cooked meals daily', 'Made with love · Delivered warm'],
  },
  {
    id: 'pickles',
    label: 'Pickles & Homemade',
    icon: '🫙',
    keywords: ['pickle', 'home-made', 'homemade', 'traditional'],
    taglines: ['Traditional • Natural • Homemade', 'Authentic taste of tradition', 'Grandma’s recipes, bottled fresh'],
  },
  {
    id: 'bakery',
    label: 'Bakery',
    icon: '🥐',
    keywords: ['bakery', 'cake'],
    taglines: ['Freshly baked every morning', 'Cakes & breads made with care', 'From our oven to your table'],
  },
  {
    id: 'spices',
    label: 'Spices & Masalas',
    icon: '🌶️',
    keywords: ['spice', 'masala'],
    taglines: ['Pure spices · Bold flavours', 'Freshly ground masalas', 'Taste the difference of purity'],
  },
  {
    id: 'snacks',
    label: 'Snacks & Sweets',
    icon: '🍬',
    keywords: ['snack', 'sweet'],
    taglines: ['Crunchy • Fresh • Homemade', 'Festival favourites, all year', 'Snacks & sweets made with love'],
  },
  {
    id: 'dairy',
    label: 'Dairy & Fresh',
    icon: '🥛',
    keywords: ['dairy', 'milk'],
    taglines: ['Farm-fresh dairy daily', 'Pure milk products you can trust', 'Fresh • Natural • Local'],
  },
  {
    id: 'organic',
    label: 'Organic Produce',
    icon: '🥬',
    keywords: ['organic'],
    taglines: ['Organic • Natural • Family farming', 'From our farm to your kitchen', 'Clean produce, honest prices'],
  },
  {
    id: 'crafts',
    label: 'Handmade Crafts',
    icon: '🧵',
    keywords: ['craft', 'decor'],
    taglines: ['Handmade with heart', 'Unique crafts for every occasion', 'Artisan made · Locally crafted'],
  },
  {
    id: 'florist',
    label: 'Florist & Plants',
    icon: '🌸',
    keywords: ['florist', 'flower', 'plant'],
    taglines: ['Fresh blooms, happy moments', 'Flowers & plants for every day', 'Bloom better with us'],
  },
  {
    id: 'clothing',
    label: 'Clothing & Apparel',
    icon: '👗',
    keywords: ['cloth', 'apparel', 'fashion'],
    taglines: ['Style that fits your everyday', 'Comfort • Quality • Value', 'Fashion for the whole family'],
  },
  {
    id: 'jewellery',
    label: 'Jewellery',
    icon: '💍',
    keywords: ['jewel'],
    taglines: ['Elegant pieces for every moment', 'Sparkle that feels personal', 'Jewellery you’ll love to wear'],
  },
  {
    id: 'beauty',
    label: 'Beauty & Wellness',
    icon: '💅',
    keywords: ['beauty', 'wellness'],
    taglines: ['Glow naturally, feel confident', 'Beauty & wellness, simplified', 'Care that shows'],
  },
  {
    id: 'stationery',
    label: 'Stationery & Books',
    icon: '📚',
    keywords: ['stationery', 'book'],
    taglines: ['Stationery for work & school', 'Books, gifts & everyday essentials', 'Write, gift, create'],
  },
  {
    id: 'electronics',
    label: 'Electronics',
    icon: '🔌',
    keywords: ['electronic', 'gadget'],
    taglines: ['Gadgets you can trust', 'Quality electronics, fair prices', 'Tech that works for you'],
  },
  {
    id: 'pets',
    label: 'Pet Supplies',
    icon: '🐾',
    keywords: ['pet'],
    taglines: ['Happy pets, happy homes', 'Care & treats your pets deserve', 'Everything for your furry friends'],
  },
  {
    id: 'grocery',
    label: 'Grocery & Kirana',
    icon: '🛒',
    keywords: ['grocery', 'kirana'],
    taglines: ['Daily essentials, delivered fresh', 'Your neighbourhood kirana online', 'Quality groceries at fair prices'],
  },
  {
    id: 'meat',
    label: 'Meat & Seafood',
    icon: '🐟',
    keywords: ['meat', 'seafood', 'fish'],
    taglines: ['Fresh cuts, hygienically packed', 'Farm to kitchen — meat & seafood', 'Clean • Fresh • Reliable'],
  },
  {
    id: 'others',
    label: 'Others',
    icon: '✨',
    keywords: [],
    taglines: ['Quality you can count on', 'Local business · Direct to you', 'Shop local, shop with trust'],
  },
]

const FALLBACK_GROUP_ID = 'others'

/** The group to open first for the vendor's Step 3 business type; Others when none fits. */
export function taglineGroupIdForBusinessType(businessTypeName: string | null | undefined): string {
  const name = businessTypeName?.trim().toLowerCase()
  if (!name) return FALLBACK_GROUP_ID
  const match = TAGLINE_EXAMPLE_GROUPS.find((group) =>
    group.keywords.some((keyword) => name.includes(keyword)),
  )
  return match?.id ?? FALLBACK_GROUP_ID
}
