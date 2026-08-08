/**
 * MithraDirect store draft — localStorage helpers + seed catalog.
 * Shared by onboarding.js and storefront.js
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'mithra_store_draft';

  var A = (global.MithraAssets && global.MithraAssets.paths) || null;
  var IMG = A || {
    logos: { dark: 'assets/img/logos/logo_dark_md.png' },
    fallbacks: {
      fresh: 'assets/img/fresh.png',
      cup: 'assets/img/cup.png',
      flower: 'assets/img/flower.png',
      batch: 'assets/img/batch.png',
      banner: 'assets/img/banner_md.png'
    },
    vendors: {
      geeta: 'assets/img/vendors/geetas-kitchen.jpg',
      geetaLogo: 'assets/img/vendors/geetas-kitchen-logo.png',
      geetaBanner: 'assets/img/vendors/geetas-kitchen-banner.png',
      saiLogo: 'assets/img/vendors/sai-ram-home-foods-logo.png',
      saiBanner: 'assets/img/vendors/sai-ram-home-foods-banner.png'
    }
  };
  var DEMO_WA =
    (A && A.external && A.external.whatsappPhone) ||
    '9912149049';
  var DEMO_CONTACT =
    (A && A.external && A.external.demoContactName) ||
    'Swamy Kunta';

  var BUSINESS_TYPES = [
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
    { id: 'others', label: 'Others', icon: '✨', keywords: 'other custom general miscellaneous any business' }
  ];

  var BUSINESS_TYPE_PAGE_SIZE = 9;

  /** Sample taglines by business type — for Store Settings examples popup. */
  var TAGLINE_EXAMPLES = {
    'home-kitchen': [
      'Homely Food, Pure Taste',
      'Fresh home-cooked meals daily',
      'Made with love · Delivered warm'
    ],
    pickles: [
      'Traditional • Natural • Homemade',
      'Authentic taste of tradition',
      'Grandma’s recipes, bottled fresh'
    ],
    bakery: [
      'Freshly baked every morning',
      'Cakes & breads made with care',
      'From our oven to your table'
    ],
    spices: [
      'Pure spices · Bold flavours',
      'Freshly ground masalas',
      'Taste the difference of purity'
    ],
    snacks: [
      'Crunchy • Fresh • Homemade',
      'Festival favourites, all year',
      'Snacks & sweets made with love'
    ],
    dairy: [
      'Farm-fresh dairy daily',
      'Pure milk products you can trust',
      'Fresh • Natural • Local'
    ],
    organic: [
      'Organic • Natural • Family farming',
      'From our farm to your kitchen',
      'Clean produce, honest prices'
    ],
    crafts: [
      'Handmade with heart',
      'Unique crafts for every occasion',
      'Artisan made · Locally crafted'
    ],
    florist: [
      'Fresh blooms, happy moments',
      'Flowers & plants for every day',
      'Bloom better with us'
    ],
    clothing: [
      'Style that fits your everyday',
      'Comfort • Quality • Value',
      'Fashion for the whole family'
    ],
    jewellery: [
      'Elegant pieces for every moment',
      'Sparkle that feels personal',
      'Jewellery you’ll love to wear'
    ],
    beauty: [
      'Glow naturally, feel confident',
      'Beauty & wellness, simplified',
      'Care that shows'
    ],
    stationery: [
      'Stationery for work & school',
      'Books, gifts & everyday essentials',
      'Write, gift, create'
    ],
    electronics: [
      'Gadgets you can trust',
      'Quality electronics, fair prices',
      'Tech that works for you'
    ],
    pets: [
      'Happy pets, happy homes',
      'Care & treats your pets deserve',
      'Everything for your furry friends'
    ],
    grocery: [
      'Daily essentials, delivered fresh',
      'Your neighbourhood kirana online',
      'Quality groceries at fair prices'
    ],
    meat: [
      'Fresh cuts, hygienically packed',
      'Farm to kitchen — meat & seafood',
      'Clean • Fresh • Reliable'
    ],
    others: [
      'Quality you can count on',
      'Local business · Direct to you',
      'Shop local, shop with trust'
    ]
  };

  function taglinesForBusiness(businessTypeId) {
    var id = String(businessTypeId || '');
    if (TAGLINE_EXAMPLES[id]) return TAGLINE_EXAMPLES[id].slice();
    return TAGLINE_EXAMPLES.others.slice();
  }

  /**
   * Simulated server page fetch for business types.
   * Replace with GET /v1/business-types?q=&page=&size= when API is ready.
   */
  function fetchBusinessTypesPage(opts) {
    opts = opts || {};
    var page = Math.max(1, Number(opts.page) || 1);
    var size = Math.max(1, Number(opts.size) || BUSINESS_TYPE_PAGE_SIZE);
    var q = String(opts.q || '')
      .toLowerCase()
      .trim();
    var filtered = BUSINESS_TYPES.filter(function (b) {
      if (!q) return true;
      var hay = [b.id, b.label, b.keywords || ''].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    var start = (page - 1) * size;
    var items = filtered.slice(start, start + size);
    return {
      items: items,
      page: page,
      size: size,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / size)),
      hasMore: start + items.length < filtered.length
    };
  }

  var CATEGORY_CATALOG = {
    pickles: [
      { id: 'pickles', name: 'Pickles', image: IMG.fallbacks.fresh },
      { id: 'combo-packs', name: 'Combo Packs', image: IMG.fallbacks.cup },
      { id: 'powders', name: 'Powders', image: IMG.fallbacks.flower },
      { id: 'chutneys', name: 'Chutneys', image: IMG.fallbacks.batch }
    ],
    'home-kitchen': [
      { id: 'meals', name: 'Meals', image: IMG.fallbacks.fresh },
      { id: 'snacks', name: 'Snacks', image: IMG.fallbacks.cup },
      { id: 'sweets', name: 'Sweets', image: IMG.fallbacks.flower }
    ],
    bakery: [
      { id: 'breads', name: 'Breads', image: IMG.fallbacks.fresh },
      { id: 'cakes', name: 'Cakes', image: IMG.fallbacks.cup },
      { id: 'cookies', name: 'Cookies', image: IMG.fallbacks.flower }
    ],
    spices: [
      { id: 'masalas', name: 'Masalas', image: IMG.fallbacks.fresh },
      { id: 'whole-spices', name: 'Whole Spices', image: IMG.fallbacks.cup }
    ],
    snacks: [
      { id: 'savory', name: 'Savory', image: IMG.fallbacks.fresh },
      { id: 'sweets', name: 'Sweets', image: IMG.fallbacks.cup }
    ],
    dairy: [
      { id: 'milk', name: 'Milk Products', image: IMG.fallbacks.fresh },
      { id: 'curd', name: 'Curd & Paneer', image: IMG.fallbacks.cup }
    ],
    organic: [
      { id: 'veggies', name: 'Vegetables', image: IMG.fallbacks.fresh },
      { id: 'fruits', name: 'Fruits', image: IMG.fallbacks.cup }
    ],
    crafts: [
      { id: 'decor', name: 'Home Decor', image: IMG.fallbacks.flower },
      { id: 'gifts', name: 'Gift Items', image: IMG.fallbacks.batch }
    ],
    florist: [
      { id: 'bouquets', name: 'Bouquets', image: IMG.fallbacks.flower },
      { id: 'plants', name: 'Plants', image: IMG.fallbacks.fresh }
    ],
    clothing: [
      { id: 'women', name: 'Women', image: IMG.fallbacks.cup },
      { id: 'men', name: 'Men', image: IMG.fallbacks.batch }
    ],
    jewellery: [
      { id: 'earrings', name: 'Earrings', image: IMG.fallbacks.flower },
      { id: 'necklaces', name: 'Necklaces', image: IMG.fallbacks.cup }
    ],
    beauty: [
      { id: 'skincare', name: 'Skincare', image: IMG.fallbacks.fresh },
      { id: 'makeup', name: 'Makeup', image: IMG.fallbacks.flower }
    ],
    stationery: [
      { id: 'notebooks', name: 'Notebooks', image: IMG.fallbacks.batch },
      { id: 'gifts', name: 'Gift Sets', image: IMG.fallbacks.cup }
    ],
    electronics: [
      { id: 'accessories', name: 'Accessories', image: IMG.fallbacks.cup },
      { id: 'gadgets', name: 'Gadgets', image: IMG.fallbacks.batch }
    ],
    pets: [
      { id: 'pet-food', name: 'Pet Food', image: IMG.fallbacks.fresh },
      { id: 'pet-care', name: 'Pet Care', image: IMG.fallbacks.cup }
    ],
    grocery: [
      { id: 'staples', name: 'Staples', image: IMG.fallbacks.fresh },
      { id: 'daily', name: 'Daily Needs', image: IMG.fallbacks.cup }
    ],
    meat: [
      { id: 'chicken', name: 'Chicken', image: IMG.fallbacks.fresh },
      { id: 'seafood', name: 'Seafood', image: IMG.fallbacks.cup }
    ],
    others: [
      { id: 'general', name: 'General', image: IMG.fallbacks.fresh },
      { id: 'bestsellers', name: 'Bestsellers', image: IMG.fallbacks.cup },
      { id: 'new-arrivals', name: 'New Arrivals', image: IMG.fallbacks.flower }
    ]
  };

  var PRODUCT_COLORS = [
    '#FEF3C7', '#FECACA', '#D1FAE5', '#DBEAFE', '#E9D5FF', '#FFEDD5'
  ];

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9);
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'my-store';
  }

  var THEME_PRESETS = [
    { id: 'emerald', label: 'Emerald', color: '#10b981' },
    { id: 'teal', label: 'Teal', color: '#0d9488' },
    { id: 'amber', label: 'Amber', color: '#d97706' },
    { id: 'rose', label: 'Rose', color: '#e11d48' },
    { id: 'sky', label: 'Sky', color: '#0284c8' },
    { id: 'forest', label: 'Forest', color: '#166534' }
  ];

  /** Accent — offers, badges, highlights (kept distinct from primary). */
  var ACCENT_PRESETS = [
    { id: 'orange', label: 'Orange', color: '#f97316' },
    { id: 'amber', label: 'Amber', color: '#f59e0b' },
    { id: 'rose', label: 'Rose', color: '#f43f5e' },
    { id: 'violet', label: 'Violet', color: '#7c3aed' },
    { id: 'sky', label: 'Sky', color: '#0ea5e9' },
    { id: 'lime', label: 'Lime', color: '#65a30d' }
  ];

  /** Store page backgrounds — neutral, readable presets for small vendors. */
  var BG_PRESETS = [
    { id: 'white', label: 'White', color: '#ffffff' },
    { id: 'soft', label: 'Soft gray', color: '#f9fafb' },
    { id: 'mint', label: 'Mint', color: '#f0fdf4' },
    { id: 'sky', label: 'Sky mist', color: '#f0f9ff' },
    { id: 'warm', label: 'Warm sand', color: '#faf6f1' },
    { id: 'ink', label: 'Charcoal', color: '#111827' }
  ];

  /** Font pairings — Google fonts loaded in global.css. */
  var FONT_PRESETS = [
    {
      id: 'poppins',
      label: 'Poppins',
      hint: 'Default',
      display: "'Poppins', 'Inter', system-ui, sans-serif",
      body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"
    },
    {
      id: 'nunito',
      label: 'Nunito',
      hint: 'Friendly',
      display: "'Nunito', system-ui, sans-serif",
      body: "'Nunito', system-ui, sans-serif"
    },
    {
      id: 'outfit',
      label: 'Outfit',
      hint: 'Modern',
      display: "'Outfit', system-ui, sans-serif",
      body: "'Outfit', system-ui, sans-serif"
    },
    {
      id: 'dm-sans',
      label: 'DM Sans',
      hint: 'Clean',
      display: "'DM Sans', system-ui, sans-serif",
      body: "'DM Sans', system-ui, sans-serif"
    },
    {
      id: 'source-sans',
      label: 'Source Sans',
      hint: 'Classic',
      display: "'Source Sans 3', system-ui, sans-serif",
      body: "'Source Sans 3', system-ui, sans-serif"
    }
  ];

  var DEFAULT_THEME = '#10b981';
  var DEFAULT_ACCENT = '#f97316';
  var DEFAULT_BG = '#f9fafb';
  var DEFAULT_FONT = 'poppins';

  function defaultDelivery() {
    return {
      storePickup: { enabled: true },
      homeDelivery: { enabled: false, charge: 40 },
      courierDelivery: { enabled: false, charge: 80 }
    };
  }

  function defaultPayment() {
    return {
      upi: { enabled: false, upiId: '', payeeName: '' },
      bank: { enabled: false, accountName: '', accountNumber: '', ifsc: '', bankName: '' },
      cod: { enabled: true }
    };
  }

  /**
   * Default SaaS entitlement after store publish.
   * Shape mirrors vendor subscription / plan APIs for UI binding.
   */
  function defaultSubscription() {
    return {
      planCode: 'FREE',
      planName: 'Free',
      status: 'ACTIVE',
      activatedAt: null,
      endsAt: null,
      vendorId: null,
      subscriptionId: null,
      features: [
        { code: 'storefront', label: 'Live storefront' },
        { code: 'whatsapp_orders', label: 'WhatsApp orders' },
        { code: 'products', label: 'Product catalog' },
        { code: 'delivery', label: 'Delivery options' },
        { code: 'payments', label: 'UPI / COD payments' },
        { code: 'branding', label: 'Theme & branding' }
      ],
      dashboardUrl: '',
      storefrontUrl: '',
      upgradeUrl: 'index.html#pricing'
    };
  }

  function emptyDraft() {
    return {
      phone: '',
      verified: false,
      businessType: '',
      categories: [],
      products: [],
      delivery: defaultDelivery(),
      payment: defaultPayment(),
      settings: {
        storeName: '',
        tagline: '',
        location: '',
        whatsapp: '',
        instagramUrl: '',
        logo: '',
        banner: '',
        themeColor: DEFAULT_THEME,
        accentColor: DEFAULT_ACCENT,
        backgroundColor: DEFAULT_BG,
        fontId: DEFAULT_FONT
      },
      slug: '',
      vendorId: null,
      subscription: defaultSubscription(),
      currentStep: 1,
      maxReachedStep: 1
    };
  }

  /**
   * Default static demo storefront (store.html) — Geeta's Kitchen
   * Matches the WhatsApp checkout screen reference.
   */
  function seedStaticStorefront() {
    var draft = seedGeetaKitchenDraft();
    draft.isStatic = true;
    draft.addresses = [
      {
        id: 'home',
        label: 'Home',
        line: 'Flat 302, Green Residency, Gachibowli, Hyderabad 500032'
      },
      {
        id: 'work',
        label: 'Work',
        line: 'HITEC City, Madhapur, Hyderabad 500081'
      }
    ];
    draft.settings.address = draft.addresses[0].line;
    draft.settings.addressWork = draft.addresses[1].line;
    draft.settings.richBanner = true;
    return draft;
  }

  /** Sample storefront: Geeta's Kitchen (reference demo) */
  function seedGeetaKitchenDraft() {
    var logo = IMG.vendors.geetaLogo || IMG.vendors.geeta;
    var banner = IMG.vendors.geetaBanner || IMG.vendors.geeta;
    var cats = [
      { id: 'pickles', name: 'Pickles', image: logo, icon: '🫙' },
      { id: 'podi', name: 'Podi', image: logo, icon: '🌶️' },
      { id: 'snacks', name: 'Snacks', image: logo, icon: '🥨' },
      { id: 'flours', name: 'Flours', image: logo, icon: '🌾' },
      { id: 'sweets', name: 'Sweets', image: logo, icon: '🍬' }
    ];

    function product(opts) {
      return {
        id: opts.id,
        name: opts.name,
        image: opts.image || '',
        icon: opts.icon || '🫙',
        color: opts.color || PRODUCT_COLORS[0],
        order: opts.order,
        categoryId: opts.categoryId,
        rating: opts.rating || 4.6,
        reviews: opts.reviews || 24,
        description: opts.description || '',
        ingredients: opts.ingredients || '',
        nutrition: opts.nutrition || 'Homemade in small batches. Exact values may vary.',
        storage: opts.storage || 'Store in a cool, dry place. Keep tightly sealed after opening.',
        deliveryInfo:
          opts.deliveryInfo ||
          'Home delivery available in Hyderabad. Orders prepared fresh the same day.',
        popular: !!opts.popular,
        variants: opts.variants
      };
    }

    function pickleSkus(prefix, base) {
      return [
        { id: prefix + '_250', label: '250 gms', price: base, mrp: base + 30, active: true },
        { id: prefix + '_500', label: '500 gms', price: base * 2 - 20, mrp: base * 2 + 20, active: true },
        { id: prefix + '_1kg', label: '1 Kg', price: Math.round(base * 3.5), mrp: Math.round(base * 4), active: true }
      ];
    }

    function podiSkus(prefix, base) {
      return [
        { id: prefix + '_200', label: '200 gms', price: base, mrp: base + 20, active: true },
        { id: prefix + '_500', label: '500 gms', price: Math.round(base * 2.2), mrp: Math.round(base * 2.5), active: true },
        { id: prefix + '_1kg', label: '1 Kg', price: Math.round(base * 4), mrp: Math.round(base * 4.5), active: true }
      ];
    }

    var products = [
      product({
        id: 'prod_avakaya',
        name: 'Avakaya Pickle',
        categoryId: 'pickles',
        order: 0,
        icon: '🥭',
        color: '#FEF3C7',
        rating: 4.8,
        reviews: 128,
        popular: true,
        description: 'Sun-cured Andhra avakaya — Homely Food, Pure Taste. 100% homemade.',
        ingredients: 'Raw mango, mustard oil, chilli powder, fenugreek, salt',
        variants: pickleSkus('sku_ava', 160)
      }),
      product({
        id: 'prod_gongura',
        name: 'Gongura Pickle',
        categoryId: 'pickles',
        order: 1,
        icon: '🌿',
        color: '#D1FAE5',
        rating: 4.7,
        reviews: 86,
        popular: true,
        description: 'Tangy gongura pickle made fresh in small batches with traditional spices.',
        ingredients: 'Gongura leaves, chilli, garlic, mustard oil, salt',
        variants: pickleSkus('sku_gongura', 150)
      }),
      product({
        id: 'prod_karam_podi',
        name: 'Karam Podi',
        categoryId: 'podi',
        order: 2,
        icon: '🌶️',
        color: '#FFEDD5',
        rating: 4.7,
        reviews: 94,
        popular: true,
        description: 'Spicy karam podi for rice, idli and dosa — pure taste from home.',
        ingredients: 'Red chilli, roasted dals, garlic, cumin, salt',
        variants: podiSkus('sku_kp', 160)
      }),
      product({
        id: 'prod_idli_podi',
        name: 'Idli Podi',
        categoryId: 'podi',
        order: 3,
        icon: '🥄',
        color: '#FFEDD5',
        rating: 4.6,
        reviews: 52,
        popular: true,
        description: 'Classic gunpowder-style idli podi with sesame and roasted dals.',
        ingredients: 'Urad dal, chana dal, sesame, red chilli, salt',
        variants: podiSkus('sku_idli', 140)
      }),
      product({
        id: 'prod_murukku',
        name: 'Murukku',
        categoryId: 'snacks',
        order: 4,
        icon: '🥨',
        color: '#FEF3C7',
        rating: 4.6,
        reviews: 41,
        popular: true,
        description: 'Crispy homemade murukku — perfect with evening chai.',
        ingredients: 'Rice flour, urad dal flour, butter, cumin, salt',
        variants: [
          { id: 'sku_mur_200', label: '200 gms', price: 90, mrp: 110, active: true },
          { id: 'sku_mur_500', label: '500 gms', price: 200, mrp: 240, active: true }
        ]
      }),
      product({
        id: 'prod_millet_laddu',
        name: 'Millet Laddu',
        categoryId: 'sweets',
        order: 5,
        icon: '🍬',
        color: '#FEF3C7',
        rating: 4.9,
        reviews: 67,
        popular: true,
        description: 'Soft millet laddus made with jaggery and ghee — festive favourite.',
        ingredients: 'Millet flour, jaggery, ghee, cardamom, cashew',
        variants: [
          { id: 'sku_lad_250', label: '250 gms', price: 180, mrp: 210, active: true },
          { id: 'sku_lad_500', label: '500 gms', price: 340, mrp: 380, active: true }
        ]
      }),
      product({
        id: 'prod_ragi_flour',
        name: 'Ragi Flour',
        categoryId: 'flours',
        order: 6,
        icon: '🌾',
        color: '#E7E5E4',
        rating: 4.5,
        reviews: 33,
        description: 'Freshly milled ragi flour — chemical free and stone-ground feel.',
        ingredients: '100% finger millet (ragi)',
        variants: [
          { id: 'sku_ragi_500', label: '500 gms', price: 75, mrp: 90, active: true },
          { id: 'sku_ragi_1kg', label: '1 Kg', price: 140, mrp: 160, active: true }
        ]
      }),
      product({
        id: 'prod_nimmakaya',
        name: 'Nimmakaya Pickle',
        categoryId: 'pickles',
        order: 7,
        icon: '🍋',
        color: '#FEF3C7',
        rating: 4.6,
        reviews: 39,
        description: 'Zesty lemon pickle with authentic chilli heat.',
        ingredients: 'Lemon, chilli powder, mustard oil, salt',
        variants: pickleSkus('sku_nimma', 130)
      })
    ];

    return {
      phone: DEMO_WA,
      verified: true,
      businessType: 'home-kitchen',
      categories: cats,
      products: products,
      delivery: {
        storePickup: { enabled: true },
        homeDelivery: { enabled: true, charge: 40 },
        courierDelivery: { enabled: true, charge: 80 }
      },
      payment: {
        upi: { enabled: true, upiId: 'geeta@upi', payeeName: "Geeta's Kitchen" },
        bank: {
          enabled: false,
          accountName: "Geeta's Kitchen",
          accountNumber: '',
          ifsc: '',
          bankName: ''
        },
        cod: { enabled: true }
      },
      settings: {
        storeName: "Geeta's Kitchen",
        tagline: 'Homely Food, Pure Taste',
        location: 'Hyderabad',
        whatsapp: DEMO_WA,
        contactName: DEMO_CONTACT,
        logo: logo,
        banner: banner,
        themeColor: '#2E5A27',
        address: 'Flat 302, Green Residency, Gachibowli, Hyderabad 500032',
        richBanner: true,
        deliveryWindow: '6 PM – 9 PM'
      },
      slug: 'geetas-kitchen',
      currentStep: 7,
      maxReachedStep: 7,
      isSample: true
    };
  }

  /** Sample storefront: Sai Ram Home Foods */
  function seedSaiRamDraft() {
    var logo = IMG.vendors.saiLogo;
    var banner = IMG.vendors.saiBanner;
    var cats = [
      { id: 'veg-pickles', name: 'Veg Pickles', image: logo, icon: '🫙' },
      { id: 'nonveg-pickles', name: 'Non-Veg Pickles', image: logo, icon: '🍗' },
      { id: 'podi', name: 'Kaaram Podulu', image: logo, icon: '🌶️' },
      { id: 'snacks', name: 'Snacks', image: logo, icon: '🥨' },
      { id: 'sweets', name: 'Sweets', image: logo, icon: '🍬' }
    ];

    function product(opts) {
      return {
        id: opts.id,
        name: opts.name,
        image: opts.image || '',
        icon: opts.icon || '🫙',
        color: opts.color || PRODUCT_COLORS[0],
        order: opts.order,
        categoryId: opts.categoryId,
        rating: opts.rating || 4.6,
        reviews: opts.reviews || 24,
        description: opts.description || '',
        ingredients: opts.ingredients || '',
        nutrition: opts.nutrition || '',
        storage: opts.storage || 'Store in a cool, dry place. Keep tightly sealed after opening.',
        deliveryInfo:
          opts.deliveryInfo ||
          'Home delivery available in Guntur, AP. Orders prepared fresh in small batches.',
        popular: !!opts.popular,
        variants: opts.variants
      };
    }

    function pickleSkus(prefix, base) {
      return [
        { id: prefix + '_250', label: '250 gms', price: base, mrp: base + 30, active: true },
        { id: prefix + '_500', label: '500 gms', price: base * 2 - 20, mrp: base * 2 + 20, active: true },
        { id: prefix + '_1kg', label: '1 kg', price: base * 3.5, mrp: base * 4, active: true }
      ];
    }

    function podiSkus(prefix, base) {
      return [
        { id: prefix + '_200', label: '200 gms', price: base, mrp: base + 20, active: true },
        { id: prefix + '_500', label: '500 gms', price: Math.round(base * 2.2), mrp: Math.round(base * 2.5), active: true }
      ];
    }

    var products = [
      product({
        id: 'prod_mango',
        name: 'Mango Pickle',
        categoryId: 'veg-pickles',
        order: 0,
        icon: '🥭',
        color: '#FEF3C7',
        rating: 4.9,
        popular: true,
        description: 'Sun-cured Andhra avakaya-style mango pickle — Amma chethi ruchi, pure & natural.',
        ingredients: 'Raw mango, mustard oil, chilli powder, fenugreek, salt',
        variants: pickleSkus('sku_mango', 160)
      }),
      product({
        id: 'prod_gongura',
        name: 'Gongura Pickle',
        categoryId: 'veg-pickles',
        order: 1,
        icon: '🌿',
        color: '#D1FAE5',
        rating: 4.8,
        popular: true,
        description: 'Tangy gongura pickle made fresh in small batches with traditional Telugu spices.',
        ingredients: 'Gongura leaves, chilli, garlic, mustard oil, salt',
        variants: pickleSkus('sku_gongura', 150)
      }),
      product({
        id: 'prod_usiri',
        name: 'Usirikaya Pickle',
        categoryId: 'veg-pickles',
        order: 2,
        icon: '🟢',
        color: '#DBEAFE',
        rating: 4.7,
        popular: true,
        description: 'Classic amla (usirikaya) pickle — chemical free, no artificial colours.',
        ingredients: 'Amla, chilli, mustard oil, salt, spices',
        variants: pickleSkus('sku_usiri', 140)
      }),
      product({
        id: 'prod_nimmakaya',
        name: 'Nimmakaya Pickle',
        categoryId: 'veg-pickles',
        order: 3,
        icon: '🍋',
        color: '#FEF3C7',
        rating: 4.6,
        description: 'Zesty lemon pickle with authentic Guntur chilli heat.',
        ingredients: 'Lemon, chilli powder, mustard oil, salt',
        variants: pickleSkus('sku_nimma', 130)
      }),
      product({
        id: 'prod_chicken',
        name: 'Chicken Pickle',
        categoryId: 'nonveg-pickles',
        order: 4,
        icon: '🍗',
        color: '#FECACA',
        rating: 4.8,
        popular: true,
        description: 'Homemade chicken pickle — bold, spicy and packed hygienically.',
        ingredients: 'Chicken, chilli, garlic, ginger, spices, oil',
        variants: pickleSkus('sku_chicken', 280)
      }),
      product({
        id: 'prod_mutton',
        name: 'Mutton Pickle',
        categoryId: 'nonveg-pickles',
        order: 5,
        icon: '🍖',
        color: '#FECACA',
        rating: 4.7,
        description: 'Traditional mutton pickle prepared with love in small batches.',
        ingredients: 'Mutton, chilli, garlic, spices, oil',
        variants: pickleSkus('sku_mutton', 320)
      }),
      product({
        id: 'prod_karam_podi',
        name: 'Kaaram Podi',
        categoryId: 'podi',
        order: 6,
        icon: '🌶️',
        color: '#FFEDD5',
        rating: 4.8,
        popular: true,
        description: 'Spicy kaaram podi for rice, idli and dosa — pure taste from home.',
        ingredients: 'Red chilli, roasted dals, garlic, cumin, salt',
        variants: podiSkus('sku_kp', 120)
      }),
      product({
        id: 'prod_kandi',
        name: 'Kandi Podi',
        categoryId: 'podi',
        order: 7,
        icon: '🥄',
        color: '#FFEDD5',
        rating: 4.6,
        popular: true,
        description: 'Roasted toor dal podi — authentic taste of tradition.',
        ingredients: 'Toor dal, red chilli, garlic, salt',
        variants: podiSkus('sku_kandi', 110)
      }),
      product({
        id: 'prod_karivepaku',
        name: 'Karivepaku Kaaram',
        categoryId: 'podi',
        order: 8,
        icon: '🍃',
        color: '#D1FAE5',
        rating: 4.7,
        description: 'Fragrant curry-leaf spice powder, chemical free and homemade.',
        ingredients: 'Curry leaves, chilli, dal, salt',
        variants: podiSkus('sku_kv', 130)
      }),
      product({
        id: 'prod_murukku',
        name: 'Janthikalu / Murukku',
        categoryId: 'snacks',
        order: 9,
        icon: '🥨',
        color: '#FEF3C7',
        rating: 4.6,
        popular: true,
        description: 'Crispy homemade murukku — perfect with evening chai.',
        ingredients: 'Rice flour, urad dal flour, butter, cumin, salt',
        variants: [
          { id: 'sku_mur_200', label: '200 gms', price: 90, mrp: 110, active: true },
          { id: 'sku_mur_500', label: '500 gms', price: 200, mrp: 240, active: true }
        ]
      }),
      product({
        id: 'prod_laddu',
        name: 'Besan Laddu',
        categoryId: 'sweets',
        order: 10,
        icon: '🍬',
        color: '#FEF3C7',
        rating: 4.8,
        popular: true,
        description: 'Soft besan laddus made with ghee and love — festive favourite.',
        ingredients: 'Besan, ghee, sugar, cardamom, cashew',
        variants: [
          { id: 'sku_lad_250', label: '250 gms', price: 180, mrp: 210, active: true },
          { id: 'sku_lad_500', label: '500 gms', price: 340, mrp: 380, active: true }
        ]
      })
    ];

    return {
      phone: DEMO_WA,
      verified: true,
      businessType: 'pickles',
      categories: cats,
      products: products,
      delivery: {
        storePickup: { enabled: true },
        homeDelivery: { enabled: true, charge: 40 },
        courierDelivery: { enabled: false, charge: 80 }
      },
      payment: {
        upi: { enabled: true, upiId: 'sairam@upi', payeeName: 'Sai Ram Home Foods' },
        bank: {
          enabled: false,
          accountName: 'Sai Ram Home Foods',
          accountNumber: '',
          ifsc: '',
          bankName: ''
        },
        cod: { enabled: true }
      },
      settings: {
        storeName: 'Sai Ram Home Foods',
        tagline: 'Authentic taste of tradition',
        location: 'Service area: Guntur, AP',
        whatsapp: DEMO_WA,
        contactName: DEMO_CONTACT,
        logo: logo,
        banner: banner,
        themeColor: '#1B5E20',
        address: 'Near Latif Hospital, Guntur, Andhra Pradesh 522001',
        richBanner: true
      },
      slug: 'sai-ram-home-foods',
      currentStep: 7,
      maxReachedStep: 7,
      isSample: true
    };
  }

  /** @deprecated Use seedStaticStorefront / seedGeetaKitchenDraft */
  function seedGeetaDraft() {
    return seedStaticStorefront();
  }

  /** Seed matching the mock: Anitha Homemade Pickles */
  function seedPickleDraft() {
    var pickleProducts = [
      { name: 'Mango Pickle', color: PRODUCT_COLORS[0] },
      { name: 'Gongura Pickle', color: PRODUCT_COLORS[1] },
      { name: 'Lemon Pickle', color: PRODUCT_COLORS[2] },
      { name: 'Garlic Pickle', color: PRODUCT_COLORS[3] }
    ].map(function (p, i) {
      return {
        id: uid('prod'),
        name: p.name,
        image: '',
        color: p.color,
        order: i,
        categoryId: 'pickles',
        variants: [
          { id: uid('sku'), label: '250g', price: 189 + i * 10, mrp: 249 + i * 10, active: true },
          { id: uid('sku'), label: '500g', price: 349 + i * 15, mrp: 449 + i * 15, active: true },
          { id: uid('sku'), label: '1kg', price: 599 + i * 20, mrp: 749 + i * 20, active: true }
        ].slice(0, i === 0 ? 3 : 2)
      };
    });

    var comboProducts = [
      { name: 'Pickle Trio Combo', color: PRODUCT_COLORS[4] },
      { name: 'Family Combo Pack', color: PRODUCT_COLORS[5] }
    ].map(function (p, i) {
      return {
        id: uid('prod'),
        name: p.name,
        image: '',
        color: p.color,
        order: pickleProducts.length + i,
        categoryId: 'combo-packs',
        variants: [
          { id: uid('sku'), label: '3 x 250g', price: 499 + i * 50, mrp: 649 + i * 50, active: true },
          { id: uid('sku'), label: '5 x 250g', price: 799 + i * 50, mrp: 999 + i * 50, active: true },
          { id: uid('sku'), label: 'Gift Box', price: 999 + i * 50, mrp: 1299 + i * 50, active: true }
        ]
      };
    });

    var products = pickleProducts.concat(comboProducts);

    return {
      phone: DEMO_WA,
      verified: true,
      businessType: 'pickles',
      categories: [
        { id: 'pickles', name: 'Pickles', image: IMG.fallbacks.fresh },
        { id: 'combo-packs', name: 'Combo Packs', image: IMG.fallbacks.cup }
      ],
      products: products,
      delivery: {
        storePickup: { enabled: true },
        homeDelivery: { enabled: true, charge: 40 },
        courierDelivery: { enabled: true, charge: 80 }
      },
      payment: {
        upi: { enabled: true, upiId: 'anitha@upi', payeeName: 'Anitha Homemade Pickles' },
        bank: {
          enabled: false,
          accountName: 'Anitha Homemade Pickles',
          accountNumber: '',
          ifsc: '',
          bankName: ''
        },
        cod: { enabled: true }
      },
      settings: {
        storeName: 'Anitha Homemade Pickles',
        tagline: 'Traditional • Natural • Homemade',
        location: 'Hyderabad, Telangana',
        whatsapp: DEMO_WA,
        contactName: DEMO_CONTACT,
        logo: '',
        banner: '',
        themeColor: '#10b981'
      },
      slug: 'anitha-homemade-pickles',
      currentStep: 1,
      maxReachedStep: 1
    };
  }

  function mergeNested(base, incoming) {
    var out = Object.assign({}, base);
    if (!incoming || typeof incoming !== 'object') return out;
    Object.keys(incoming).forEach(function (key) {
      if (
        incoming[key] &&
        typeof incoming[key] === 'object' &&
        !Array.isArray(incoming[key]) &&
        base[key] &&
        typeof base[key] === 'object'
      ) {
        out[key] = Object.assign({}, base[key], incoming[key]);
      } else {
        out[key] = incoming[key];
      }
    });
    return out;
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyDraft();
      var data = JSON.parse(raw);
      var blank = emptyDraft();
      var draft = Object.assign(blank, data, {
        settings: Object.assign({}, blank.settings, data.settings || {}),
        delivery: mergeNested(blank.delivery, data.delivery),
        payment: mergeNested(blank.payment, data.payment),
        subscription: Object.assign({}, blank.subscription, data.subscription || {})
      });
      if (!draft.settings.themeColor) draft.settings.themeColor = DEFAULT_THEME;
      if (!draft.settings.accentColor) draft.settings.accentColor = DEFAULT_ACCENT;
      if (!draft.settings.backgroundColor) draft.settings.backgroundColor = DEFAULT_BG;
      if (!draft.settings.fontId) draft.settings.fontId = DEFAULT_FONT;
      if (draft.settings.instagramUrl == null) draft.settings.instagramUrl = '';
      if (!Array.isArray(draft.subscription.features) || !draft.subscription.features.length) {
        draft.subscription.features = blank.subscription.features;
      }
      (draft.products || []).forEach(function (p) {
        (p.variants || []).forEach(function (v) {
          if (v.mrp == null && v.stock != null) {
            v.mrp = Number(v.price) > 0 ? Math.round(Number(v.price) * 1.25) : 0;
          }
          if (v.mrp == null) v.mrp = Number(v.price) || 0;
          if (typeof v.active !== 'boolean') v.active = true;
          delete v.stock;
        });
      });
      return draft;
    } catch (e) {
      return emptyDraft();
    }
  }

  function saveDraft(draft) {
    if (draft.settings && draft.settings.storeName) {
      draft.slug = slugify(draft.settings.storeName);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    return draft;
  }

  function clearDraft() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function countSkus(draft) {
    return (draft.products || []).reduce(function (n, p) {
      return n + ((p.variants && p.variants.length) || 0);
    }, 0);
  }

  function minPrice(product) {
    if (!product.variants || !product.variants.length) return 0;
    var active = product.variants.filter(function (v) {
      return v.active !== false;
    });
    var list = active.length ? active : product.variants;
    var prices = list
      .map(function (v) {
        return Number(v.price) || 0;
      })
      .filter(function (n) {
        return n > 0;
      });
    if (!prices.length) return 0;
    return Math.min.apply(null, prices);
  }

  function categoriesForBusiness(businessTypeId) {
    return (CATEGORY_CATALOG[businessTypeId] || []).slice();
  }

  function normalizeHex(color) {
    var c = String(color || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(c)) {
      return ('#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]).toLowerCase();
    }
    return DEFAULT_THEME;
  }

  function hexToRgba(hex, alpha) {
    var h = normalizeHex(hex).slice(1);
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function relativeLuminance(hex) {
    var h = normalizeHex(hex).slice(1);
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000;
  }

  function isLightHex(hex) {
    return relativeLuminance(hex) > 210;
  }

  function isDarkHex(hex) {
    return relativeLuminance(hex) < 140;
  }

  function getFontPreset(fontId) {
    var id = String(fontId || DEFAULT_FONT);
    var found = null;
    for (var i = 0; i < FONT_PRESETS.length; i++) {
      if (FONT_PRESETS[i].id === id) {
        found = FONT_PRESETS[i];
        break;
      }
    }
    return found || FONT_PRESETS[0];
  }

  /**
   * Apply vendor theme across the page (onboarding, storefront, dashboard).
   * Sets CSS vars consumed by global / feature stylesheets.
   */
  function applyTheme(color, root) {
    var hex = normalizeHex(color || DEFAULT_THEME);
    var el = root || document.documentElement;
    el.style.setProperty('--store-theme', hex);
    el.style.setProperty('--store-theme-soft', hexToRgba(hex, 0.14));
    el.style.setProperty('--store-theme-muted', hexToRgba(hex, 0.22));
    el.style.setProperty('--store-theme-overlay', hexToRgba(hex, 0.78));
    el.style.setProperty('--store-theme-overlay-mid', hexToRgba(hex, 0.32));
    el.style.setProperty('--store-theme-overlay-light', hexToRgba(hex, 0.1));
    el.setAttribute('data-store-theme', hex);
    if (el === document.documentElement && document.body) {
      document.body.classList.add('store-themed');
    }
    return hex;
  }

  /**
   * Apply full vendor branding: primary, accent, background, font.
   * Scoped to onboarding.html, store.html, and dashboard.html only.
   * settings: { themeColor, accentColor, backgroundColor, fontId }
   */
  function applyStoreBrand(settings, root) {
    settings = settings || {};
    var body = typeof document !== 'undefined' ? document.body : null;
    var surface = 'none';
    if (body) {
      if (body.classList.contains('store-page')) surface = 'store';
      else if (body.classList.contains('dash-page')) surface = 'dashboard';
      else if (body.classList.contains('onboarding-page')) surface = 'onboarding';
    }
    // Do not mutate branding on landing / other pages
    if (surface === 'none' && !root) {
      return {
        themeColor: normalizeHex(settings.themeColor || DEFAULT_THEME),
        accentColor: DEFAULT_ACCENT,
        backgroundColor: DEFAULT_BG,
        fontId: DEFAULT_FONT
      };
    }

    var el = root || document.documentElement;
    var theme = applyTheme(settings.themeColor, el);

    var accentRaw = String(settings.accentColor || '').trim();
    var accent = /^#[0-9a-fA-F]{3,6}$/.test(accentRaw)
      ? normalizeHex(accentRaw)
      : DEFAULT_ACCENT;

    var bgRaw = String(settings.backgroundColor || '').trim();
    var bg = /^#[0-9a-fA-F]{3,6}$/.test(bgRaw) ? normalizeHex(bgRaw) : DEFAULT_BG;

    var font = getFontPreset(settings.fontId);

    el.style.setProperty('--store-accent', accent);
    el.style.setProperty('--store-accent-soft', hexToRgba(accent, 0.16));
    el.style.setProperty('--store-accent-muted', hexToRgba(accent, 0.28));
    el.setAttribute('data-store-accent', accent);
    el.setAttribute('data-store-font', font.id);
    el.setAttribute('data-store-bg', bg);

    // Background + ink: storefront canvas; dashboard keeps Mithra atmosphere
    if (surface === 'store' || root) {
      el.style.setProperty('--store-bg', bg);
      if (isDarkHex(bg)) {
        el.style.setProperty('--store-ink', '#f9fafb');
        el.style.setProperty('--store-muted', '#9ca3af');
        el.style.setProperty('--store-border', 'rgba(255,255,255,0.12)');
        el.style.setProperty('--md-panel-bg', '#1f2937');
      } else {
        el.style.setProperty('--store-ink', '#111827');
        el.style.setProperty('--store-muted', '#6b7280');
        el.style.setProperty('--store-border', '#e5e7eb');
        el.style.setProperty('--md-panel-bg', '#ffffff');
      }
    }

    // Vendor fonts on store + dashboard; onboarding chrome stays Mithra (preview uses inline)
    if (surface === 'store' || surface === 'dashboard' || root) {
      el.style.setProperty('--font-display', font.display);
      el.style.setProperty('--font-body', font.body);
    }

    return {
      themeColor: theme,
      accentColor: accent,
      backgroundColor: bg,
      fontId: font.id
    };
  }

  function whatsappLink(phone, message) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10) digits = '91' + digits;
    var text = encodeURIComponent(message || 'Hi, I would like to place an order.');
    return 'https://wa.me/' + digits + '?text=' + text;
  }

  /** Absolute URL for QR / share (works for relative store.html links). */
  function absoluteUrl(href) {
    try {
      return new URL(href || '', window.location.href).href;
    } catch (e) {
      return String(href || '');
    }
  }

  /**
   * QR image URL for a shop link (no local library required).
   * size: pixel width/height, default 240.
   */
  function qrImageUrl(data, size) {
    var px = size || 240;
    var payload = absoluteUrl(data);
    return (
      'https://api.qrserver.com/v1/create-qr-code/?size=' +
      px +
      'x' +
      px +
      '&margin=12&ecc=M&data=' +
      encodeURIComponent(payload)
    );
  }

  function downloadQrImage(remoteUrl, filename) {
    filename = filename || 'mithradirect-shop-qr.png';
    function saveBlob(blob) {
      var objectUrl = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(objectUrl);
      }, 1500);
    }
    fetch(remoteUrl, { mode: 'cors' })
      .then(function (r) {
        return r.blob();
      })
      .then(saveBlob)
      .catch(function () {
        window.open(remoteUrl, '_blank');
      });
  }

  global.MithraDraft = {
    STORAGE_KEY: STORAGE_KEY,
    BUSINESS_TYPES: BUSINESS_TYPES,
    BUSINESS_TYPE_PAGE_SIZE: BUSINESS_TYPE_PAGE_SIZE,
    TAGLINE_EXAMPLES: TAGLINE_EXAMPLES,
    taglinesForBusiness: taglinesForBusiness,
    fetchBusinessTypesPage: fetchBusinessTypesPage,
    PRODUCT_COLORS: PRODUCT_COLORS,
    THEME_PRESETS: THEME_PRESETS,
    ACCENT_PRESETS: ACCENT_PRESETS,
    BG_PRESETS: BG_PRESETS,
    FONT_PRESETS: FONT_PRESETS,
    DEFAULT_THEME: DEFAULT_THEME,
    DEFAULT_ACCENT: DEFAULT_ACCENT,
    DEFAULT_BG: DEFAULT_BG,
    DEFAULT_FONT: DEFAULT_FONT,
    uid: uid,
    slugify: slugify,
    normalizeHex: normalizeHex,
    hexToRgba: hexToRgba,
    isLightHex: isLightHex,
    isDarkHex: isDarkHex,
    getFontPreset: getFontPreset,
    applyTheme: applyTheme,
    applyStoreBrand: applyStoreBrand,
    emptyDraft: emptyDraft,
    defaultSubscription: defaultSubscription,
    seedPickleDraft: seedPickleDraft,
    seedGeetaDraft: seedGeetaDraft,
    seedGeetaKitchenDraft: seedGeetaKitchenDraft,
    seedSaiRamDraft: seedSaiRamDraft,
    seedStaticStorefront: seedStaticStorefront,
    loadDraft: loadDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    countSkus: countSkus,
    minPrice: minPrice,
    categoriesForBusiness: categoriesForBusiness,
    whatsappLink: whatsappLink,
    absoluteUrl: absoluteUrl,
    qrImageUrl: qrImageUrl,
    downloadQrImage: downloadQrImage
  };
})(typeof window !== 'undefined' ? window : this);
