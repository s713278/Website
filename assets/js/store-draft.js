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
    { id: 'home-kitchen', label: 'Home Kitchen', icon: '🏠' },
    { id: 'pickles', label: 'Pickles & Homemade', icon: '🫙' },
    { id: 'bakery', label: 'Bakery', icon: '🥐' },
    { id: 'spices', label: 'Spices & Masalas', icon: '🌶️' },
    { id: 'snacks', label: 'Snacks & Sweets', icon: '🍬' },
    { id: 'dairy', label: 'Dairy & Fresh', icon: '🥛' },
    { id: 'organic', label: 'Organic Produce', icon: '🥬' },
    { id: 'crafts', label: 'Handmade Crafts', icon: '🧵' }
  ];

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
        logo: '',
        banner: '',
        themeColor: '#10b981'
      },
      slug: '',
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
        payment: mergeNested(blank.payment, data.payment)
      });
      if (!draft.settings.themeColor) draft.settings.themeColor = '#10b981';
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

  function whatsappLink(phone, message) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10) digits = '91' + digits;
    var text = encodeURIComponent(message || 'Hi, I would like to place an order.');
    return 'https://wa.me/' + digits + '?text=' + text;
  }

  global.MithraDraft = {
    STORAGE_KEY: STORAGE_KEY,
    BUSINESS_TYPES: BUSINESS_TYPES,
    PRODUCT_COLORS: PRODUCT_COLORS,
    THEME_PRESETS: THEME_PRESETS,
    uid: uid,
    slugify: slugify,
    emptyDraft: emptyDraft,
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
    whatsappLink: whatsappLink
  };
})(typeof window !== 'undefined' ? window : this);
