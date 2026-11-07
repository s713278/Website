/**
 * Onboarding catalog seed — business type → categories → default products.
 *
 * Source: design-reference onboarding (`BUSINESS_TYPES` + `CATEGORY_CATALOG`
 * in `design-reference/assets/js/store-draft.js`). Product names follow the
 * pickle / home-kitchen demo seeds and category-appropriate defaults.
 *
 * `iconImage` is a Twemoji PNG (emoji rendered as an image). Category `image`
 * matches the circular tiles in the static onboarding wizard.
 */

const TWEMOJI = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72'

function iconImage(codepoint: string): string {
  return `${TWEMOJI}/${codepoint}.png`
}

/** Circular category tiles used in design-reference onboarding. */
const CAT_TILE = {
  fresh: 'assets/img/fresh.png',
  cup: 'assets/img/cup.png',
  flower: 'assets/img/flower.png',
  batch: 'assets/img/batch.png',
} as const

export type OnboardingProduct = {
  id: string
  name: string
  icon: string
  iconImage: string
}

export type OnboardingCategory = {
  id: string
  name: string
  icon: string
  iconImage: string
  /** Design-reference circular tile (relative to `design-reference/`). */
  image: string
  products: OnboardingProduct[]
}

export type OnboardingBusinessType = {
  id: string
  label: string
  icon: string
  iconImage: string
  keywords: string
  categories: OnboardingCategory[]
}

function product(id: string, name: string, icon: string, hex: string): OnboardingProduct {
  return { id, name, icon, iconImage: iconImage(hex) }
}

function category(
  id: string,
  name: string,
  icon: string,
  hex: string,
  tile: keyof typeof CAT_TILE,
  products: OnboardingProduct[],
): OnboardingCategory {
  return { id, name, icon, iconImage: iconImage(hex), image: CAT_TILE[tile], products }
}

export const ONBOARDING_CATALOG: OnboardingBusinessType[] = [
  {
    id: 'home-kitchen',
    label: 'Home Kitchen',
    icon: '🏠',
    iconImage: iconImage('1f3e0'),
    keywords: 'home cooked meals tiffin catering food',
    categories: [
      category('meals', 'Meals', '🍛', '1f35b', 'fresh', [
        product('home-kitchen__meals__veg-thali', 'Veg Thali', '🍛', '1f35b'),
        product('home-kitchen__meals__chicken-curry-meal', 'Chicken Curry Meal', '🍗', '1f357'),
        product('home-kitchen__meals__millet-power-bowl', 'Millet Power Bowl', '🥗', '1f957'),
        product('home-kitchen__meals__tiffin-combo', 'Tiffin Combo', '🍱', '1f371'),
      ]),
      category('snacks', 'Snacks', '🥨', '1f968', 'cup', [
        product('home-kitchen__snacks__murukku', 'Murukku', '🥨', '1f968'),
        product('home-kitchen__snacks__mixture', 'Mixture', '🥜', '1f95c'),
        product('home-kitchen__snacks__banana-chips', 'Banana Chips', '🍌', '1f34c'),
      ]),
      category('sweets', 'Sweets', '🍬', '1f36c', 'flower', [
        product('home-kitchen__sweets__millet-laddu', 'Millet Laddu', '🍬', '1f36c'),
        product('home-kitchen__sweets__besan-laddu', 'Besan Laddu', '🍯', '1f36f'),
        product('home-kitchen__sweets__coconut-barfi', 'Coconut Barfi', '🥥', '1f965'),
      ]),
    ],
  },
  {
    id: 'pickles',
    label: 'Pickles & Homemade',
    icon: '🫙',
    iconImage: iconImage('1fad9'),
    keywords: 'pickle achar podi chutney homemade',
    categories: [
      category('pickles', 'Pickles', '🫙', '1fad9', 'fresh', [
        product('pickles__pickles__mango', 'Mango Pickle', '🥭', '1f96d'),
        product('pickles__pickles__gongura', 'Gongura Pickle', '🌿', '1f33f'),
        product('pickles__pickles__lemon', 'Lemon Pickle', '🍋', '1f34b'),
        product('pickles__pickles__garlic', 'Garlic Pickle', '🧄', '1f9c4'),
      ]),
      category('combo-packs', 'Combo Packs', '🎁', '1f381', 'cup', [
        product('pickles__combo-packs__trio', 'Pickle Trio Combo', '🎁', '1f381'),
        product('pickles__combo-packs__family', 'Family Combo Pack', '📦', '1f4e6'),
        product('pickles__combo-packs__gift-box', 'Gift Box', '🎀', '1f380'),
      ]),
      category('powders', 'Powders', '🌶️', '1f336', 'flower', [
        product('pickles__powders__karam-podi', 'Karam Podi', '🌶️', '1f336'),
        product('pickles__powders__idli-podi', 'Idli Podi', '🥄', '1f944'),
        product('pickles__powders__kandi-podi', 'Kandi Podi', '🫘', '1fad8'),
        product('pickles__powders__karivepaku', 'Karivepaku Kaaram', '🍃', '1f343'),
      ]),
      category('chutneys', 'Chutneys', '🥣', '1f963', 'batch', [
        product('pickles__chutneys__coconut', 'Coconut Chutney', '🥥', '1f965'),
        product('pickles__chutneys__tomato', 'Tomato Chutney', '🍅', '1f345'),
        product('pickles__chutneys__ginger', 'Ginger Chutney', '🫚', '1fada'),
      ]),
    ],
  },
  {
    id: 'bakery',
    label: 'Bakery',
    icon: '🥐',
    iconImage: iconImage('1f950'),
    keywords: 'cake bread pastry cookies bakery',
    categories: [
      category('breads', 'Breads', '🍞', '1f35e', 'fresh', [
        product('bakery__breads__sandwich', 'Sandwich Bread', '🍞', '1f35e'),
        product('bakery__breads__multigrain', 'Multigrain Loaf', '🌾', '1f33e'),
        product('bakery__breads__pav', 'Pav Buns', '🥐', '1f950'),
      ]),
      category('cakes', 'Cakes', '🎂', '1f382', 'cup', [
        product('bakery__cakes__chocolate', 'Chocolate Cake', '🎂', '1f382'),
        product('bakery__cakes__butterscotch', 'Butterscotch Cake', '🍰', '1f370'),
        product('bakery__cakes__cupcakes', 'Cupcakes', '🧁', '1f9c1'),
      ]),
      category('cookies', 'Cookies', '🍪', '1f36a', 'flower', [
        product('bakery__cookies__butter', 'Butter Cookies', '🍪', '1f36a'),
        product('bakery__cookies__jeera', 'Jeera Biscuits', '🥨', '1f968'),
        product('bakery__cookies__choco-chip', 'Chocolate Chip Cookies', '🍫', '1f36b'),
      ]),
    ],
  },
  {
    id: 'spices',
    label: 'Spices & Masalas',
    icon: '🌶️',
    iconImage: iconImage('1f336'),
    keywords: 'spice masala powder seasonings',
    categories: [
      category('masalas', 'Masalas', '🌶️', '1f336', 'fresh', [
        product('spices__masalas__garam', 'Garam Masala', '🌶️', '1f336'),
        product('spices__masalas__sambar', 'Sambar Powder', '🥄', '1f944'),
        product('spices__masalas__biryani', 'Biryani Masala', '🍛', '1f35b'),
        product('spices__masalas__rasam', 'Rasam Powder', '🥣', '1f963'),
      ]),
      category('whole-spices', 'Whole Spices', '🌿', '1f33f', 'cup', [
        product('spices__whole-spices__cardamom', 'Green Cardamom', '🟢', '1f7e2'),
        product('spices__whole-spices__cloves', 'Cloves', '🟤', '1f7e4'),
        product('spices__whole-spices__cinnamon', 'Cinnamon Sticks', '🪵', '1fab5'),
      ]),
    ],
  },
  {
    id: 'snacks',
    label: 'Snacks & Sweets',
    icon: '🍬',
    iconImage: iconImage('1f36c'),
    keywords: 'snacks sweets namkeen mithai',
    categories: [
      category('savory', 'Savory', '🥨', '1f968', 'fresh', [
        product('snacks__savory__mixture', 'Namkeen Mixture', '🥨', '1f968'),
        product('snacks__savory__murukku', 'Murukku', '🥨', '1f968'),
        product('snacks__savory__thattai', 'Thattai', '🍘', '1f358'),
      ]),
      category('sweets', 'Sweets', '🍬', '1f36c', 'cup', [
        product('snacks__sweets__mysore-pak', 'Mysore Pak', '🍬', '1f36c'),
        product('snacks__sweets__laddu', 'Besan Laddu', '🍯', '1f36f'),
        product('snacks__sweets__halwa', 'Carrot Halwa', '🥕', '1f955'),
      ]),
    ],
  },
  {
    id: 'dairy',
    label: 'Dairy & Fresh',
    icon: '🥛',
    iconImage: iconImage('1f95b'),
    keywords: 'milk curd paneer ghee dairy',
    categories: [
      category('milk', 'Milk Products', '🥛', '1f95b', 'fresh', [
        product('dairy__milk__toned', 'Toned Milk', '🥛', '1f95b'),
        product('dairy__milk__ghee', 'Cow Ghee', '🧈', '1f9c8'),
        product('dairy__milk__buttermilk', 'Buttermilk', '🥤', '1f964'),
      ]),
      category('curd', 'Curd & Paneer', '🧀', '1f9c0', 'cup', [
        product('dairy__curd__fresh-curd', 'Fresh Curd', '🥣', '1f963'),
        product('dairy__curd__paneer', 'Malai Paneer', '🧀', '1f9c0'),
        product('dairy__curd__hung-curd', 'Hung Curd', '🥛', '1f95b'),
      ]),
    ],
  },
  {
    id: 'organic',
    label: 'Organic Produce',
    icon: '🥬',
    iconImage: iconImage('1f96c'),
    keywords: 'organic vegetables fruits farm',
    categories: [
      category('veggies', 'Vegetables', '🥬', '1f96c', 'fresh', [
        product('organic__veggies__tomato', 'Organic Tomato', '🍅', '1f345'),
        product('organic__veggies__spinach', 'Palak / Spinach', '🥬', '1f96c'),
        product('organic__veggies__carrot', 'Farm Carrot', '🥕', '1f955'),
      ]),
      category('fruits', 'Fruits', '🍎', '1f34e', 'cup', [
        product('organic__fruits__banana', 'Farm Banana', '🍌', '1f34c'),
        product('organic__fruits__mango', 'Seasonal Mango', '🥭', '1f96d'),
        product('organic__fruits__apple', 'Apple', '🍎', '1f34e'),
      ]),
    ],
  },
  {
    id: 'crafts',
    label: 'Handmade Crafts',
    icon: '🧵',
    iconImage: iconImage('1f9f5'),
    keywords: 'craft handmade decor gifts art',
    categories: [
      category('decor', 'Home Decor', '🖼️', '1f5bc', 'flower', [
        product('crafts__decor__wall-hanging', 'Wall Hanging', '🖼️', '1f5bc'),
        product('crafts__decor__diya-set', 'Diya Set', '🪔', '1fa94'),
        product('crafts__decor__cushion', 'Handloom Cushion', '🧵', '1f9f5'),
      ]),
      category('gifts', 'Gift Items', '🎁', '1f381', 'batch', [
        product('crafts__gifts__gift-hamper', 'Gift Hamper', '🎁', '1f381'),
        product('crafts__gifts__handmade-card', 'Handmade Card', '💌', '1f48c'),
        product('crafts__gifts__keychain', 'Craft Keychain', '🔑', '1f511'),
      ]),
    ],
  },
  {
    id: 'florist',
    label: 'Florist & Plants',
    icon: '🌸',
    iconImage: iconImage('1f338'),
    keywords: 'flowers plants bouquet nursery',
    categories: [
      category('bouquets', 'Bouquets', '💐', '1f490', 'flower', [
        product('florist__bouquets__rose', 'Rose Bouquet', '🌹', '1f339'),
        product('florist__bouquets__mixed', 'Mixed Bouquet', '💐', '1f490'),
        product('florist__bouquets__garland', 'Jasmine Garland', '🌼', '1f33c'),
      ]),
      category('plants', 'Plants', '🪴', '1fab4', 'fresh', [
        product('florist__plants__money-plant', 'Money Plant', '🪴', '1fab4'),
        product('florist__plants__tulsi', 'Tulsi Plant', '🌿', '1f33f'),
        product('florist__plants__snake-plant', 'Snake Plant', '🌱', '1f331'),
      ]),
    ],
  },
  {
    id: 'clothing',
    label: 'Clothing & Apparel',
    icon: '👗',
    iconImage: iconImage('1f457'),
    keywords: 'clothes fashion boutique garments',
    categories: [
      category('women', 'Women', '👗', '1f457', 'cup', [
        product('clothing__women__kurti', 'Cotton Kurti', '👗', '1f457'),
        product('clothing__women__saree', 'Handloom Saree', '🧵', '1f9f5'),
        product('clothing__women__dupatta', 'Dupatta', '🧣', '1f9e3'),
      ]),
      category('men', 'Men', '👔', '1f454', 'batch', [
        product('clothing__men__shirt', 'Casual Shirt', '👔', '1f454'),
        product('clothing__men__kurta', 'Cotton Kurta', '👕', '1f455'),
        product('clothing__men__dhoti', 'Dhoti', '🩳', '1fa73'),
      ]),
    ],
  },
  {
    id: 'jewellery',
    label: 'Jewellery',
    icon: '💍',
    iconImage: iconImage('1f48d'),
    keywords: 'jewellery jewelry ornaments gold silver',
    categories: [
      category('earrings', 'Earrings', '💎', '1f48e', 'flower', [
        product('jewellery__earrings__jhumka', 'Jhumka Earrings', '💎', '1f48e'),
        product('jewellery__earrings__studs', 'Gold-plated Studs', '✨', '2728'),
        product('jewellery__earrings__hoops', 'Hoop Earrings', '⭕', '2b55'),
      ]),
      category('necklaces', 'Necklaces', '📿', '1f4ff', 'cup', [
        product('jewellery__necklaces__chain', 'Pendant Chain', '📿', '1f4ff'),
        product('jewellery__necklaces__choker', 'Temple Choker', '💍', '1f48d'),
        product('jewellery__necklaces__mangalsutra', 'Mangalsutra', '🟡', '1f7e1'),
      ]),
    ],
  },
  {
    id: 'beauty',
    label: 'Beauty & Wellness',
    icon: '💅',
    iconImage: iconImage('1f485'),
    keywords: 'beauty salon spa cosmetics wellness',
    categories: [
      category('skincare', 'Skincare', '🧴', '1f9f4', 'fresh', [
        product('beauty__skincare__face-pack', 'Herbal Face Pack', '🌿', '1f33f'),
        product('beauty__skincare__oil', 'Coconut Hair Oil', '🧴', '1f9f4'),
        product('beauty__skincare__soap', 'Handmade Soap', '🧼', '1f9fc'),
      ]),
      category('makeup', 'Makeup', '💄', '1f484', 'flower', [
        product('beauty__makeup__kajal', 'Kajal', '✒️', '2712'),
        product('beauty__makeup__lipstick', 'Lipstick', '💄', '1f484'),
        product('beauty__makeup__bindi', 'Bindi Pack', '🔴', '1f534'),
      ]),
    ],
  },
  {
    id: 'stationery',
    label: 'Stationery & Books',
    icon: '📚',
    iconImage: iconImage('1f4da'),
    keywords: 'books stationery gifts office',
    categories: [
      category('notebooks', 'Notebooks', '📓', '1f4d3', 'batch', [
        product('stationery__notebooks__ruled', 'Ruled Notebook', '📓', '1f4d3'),
        product('stationery__notebooks__diary', 'Hardcover Diary', '📔', '1f4d4'),
        product('stationery__notebooks__sticky', 'Sticky Notes', '📝', '1f4dd'),
      ]),
      category('gifts', 'Gift Sets', '🎁', '1f381', 'cup', [
        product('stationery__gifts__pen-set', 'Pen Gift Set', '✒️', '2712'),
        product('stationery__gifts__art-kit', 'Art Kit', '🎨', '1f3a8'),
        product('stationery__gifts__bookmark', 'Bookmark Set', '🔖', '1f516'),
      ]),
    ],
  },
  {
    id: 'electronics',
    label: 'Electronics',
    icon: '🔌',
    iconImage: iconImage('1f50c'),
    keywords: 'electronics mobiles accessories gadgets',
    categories: [
      category('accessories', 'Accessories', '🎧', '1f3a7', 'cup', [
        product('electronics__accessories__earphones', 'Wired Earphones', '🎧', '1f3a7'),
        product('electronics__accessories__charger', 'Phone Charger', '🔌', '1f50c'),
        product('electronics__accessories__case', 'Phone Case', '📱', '1f4f1'),
      ]),
      category('gadgets', 'Gadgets', '⌚', '231a', 'batch', [
        product('electronics__gadgets__power-bank', 'Power Bank', '🔋', '1f50b'),
        product('electronics__gadgets__trimmer', 'Trimmer', '🪒', '1fa92'),
        product('electronics__gadgets__led-lamp', 'LED Lamp', '💡', '1f4a1'),
      ]),
    ],
  },
  {
    id: 'pets',
    label: 'Pet Supplies',
    icon: '🐾',
    iconImage: iconImage('1f43e'),
    keywords: 'pets dogs cats food accessories',
    categories: [
      category('pet-food', 'Pet Food', '🦴', '1f9b4', 'fresh', [
        product('pets__pet-food__dog-kibble', 'Dog Kibble', '🐶', '1f436'),
        product('pets__pet-food__cat-food', 'Cat Food', '🐱', '1f431'),
        product('pets__pet-food__treats', 'Pet Treats', '🦴', '1f9b4'),
      ]),
      category('pet-care', 'Pet Care', '🧴', '1f9f4', 'cup', [
        product('pets__pet-care__shampoo', 'Pet Shampoo', '🧴', '1f9f4'),
        product('pets__pet-care__collar', 'Collar & Leash', '🦮', '1f9ae'),
        product('pets__pet-care__bowl', 'Feeding Bowl', '🥣', '1f963'),
      ]),
    ],
  },
  {
    id: 'grocery',
    label: 'Grocery & Kirana',
    icon: '🛒',
    iconImage: iconImage('1f6d2'),
    keywords: 'grocery kirana provisions staples',
    categories: [
      category('staples', 'Staples', '🌾', '1f33e', 'fresh', [
        product('grocery__staples__rice', 'Sona Masoori Rice', '🍚', '1f35a'),
        product('grocery__staples__toor-dal', 'Toor Dal', '🫘', '1fad8'),
        product('grocery__staples__atta', 'Wheat Atta', '🌾', '1f33e'),
      ]),
      category('daily', 'Daily Needs', '🛒', '1f6d2', 'cup', [
        product('grocery__daily__oil', 'Groundnut Oil', '🫒', '1fad2'),
        product('grocery__daily__sugar', 'Sugar', '🧂', '1f9c2'),
        product('grocery__daily__tea', 'Tea Dust', '🍵', '1f375'),
      ]),
    ],
  },
  {
    id: 'meat',
    label: 'Meat & Seafood',
    icon: '🐟',
    iconImage: iconImage('1f41f'),
    keywords: 'meat chicken fish seafood',
    categories: [
      category('chicken', 'Chicken', '🍗', '1f357', 'fresh', [
        product('meat__chicken__curry-cut', 'Curry Cut Chicken', '🍗', '1f357'),
        product('meat__chicken__boneless', 'Boneless Chicken', '🍖', '1f356'),
        product('meat__chicken__eggs', 'Farm Eggs', '🥚', '1f95a'),
      ]),
      category('seafood', 'Seafood', '🦐', '1f990', 'cup', [
        product('meat__seafood__rohu', 'Rohu Fish', '🐟', '1f41f'),
        product('meat__seafood__prawns', 'Prawns', '🦐', '1f990'),
        product('meat__seafood__crab', 'Crab', '🦀', '1f980'),
      ]),
    ],
  },
  {
    id: 'others',
    label: 'Others',
    icon: '✨',
    iconImage: iconImage('2728'),
    keywords: 'other custom general miscellaneous any business',
    categories: [
      category('general', 'General', '📦', '1f4e6', 'fresh', [
        product('others__general__starter', 'Starter Item', '📦', '1f4e6'),
        product('others__general__daily', 'Daily Essential', '🛒', '1f6d2'),
        product('others__general__custom', 'Custom Product', '✨', '2728'),
      ]),
      category('bestsellers', 'Bestsellers', '⭐', '2b50', 'cup', [
        product('others__bestsellers__house-special', 'House Special', '⭐', '2b50'),
        product('others__bestsellers__most-ordered', 'Most Ordered', '🔥', '1f525'),
        product('others__bestsellers__combo', 'Combo Deal', '🎁', '1f381'),
      ]),
      category('new-arrivals', 'New Arrivals', '🆕', '1f195', 'flower', [
        product('others__new-arrivals__this-week', "This Week's New", '🆕', '1f195'),
        product('others__new-arrivals__limited', 'Limited Batch', '⏳', '23f3'),
        product('others__new-arrivals__seasonal', 'Seasonal Pick', '🍂', '1f342'),
      ]),
    ],
  },
]

export function getBusinessType(id: string): OnboardingBusinessType | undefined {
  return ONBOARDING_CATALOG.find((b) => b.id === id)
}

export function categoriesForBusiness(businessTypeId: string): OnboardingCategory[] {
  return getBusinessType(businessTypeId)?.categories.slice() ?? []
}

export function productsForCategory(
  businessTypeId: string,
  categoryId: string,
): OnboardingProduct[] {
  const cat = categoriesForBusiness(businessTypeId).find((c) => c.id === categoryId)
  return cat?.products.slice() ?? []
}

export const ONBOARDING_CATALOG_COUNTS = {
  businessTypes: ONBOARDING_CATALOG.length,
  categories: ONBOARDING_CATALOG.reduce((n, b) => n + b.categories.length, 0),
  products: ONBOARDING_CATALOG.reduce(
    (n, b) => n + b.categories.reduce((m, c) => m + c.products.length, 0),
    0,
  ),
} as const
