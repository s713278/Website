/**
 * MithraDirect store draft — localStorage helpers + seed catalog.
 * Shared by onboarding.js and storefront.js
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'mithra_store_draft';

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
      { id: 'pickles', name: 'Pickles', image: 'assets/img/fresh.png' },
      { id: 'combo-packs', name: 'Combo Packs', image: 'assets/img/cup.png' },
      { id: 'powders', name: 'Powders', image: 'assets/img/flower.png' },
      { id: 'chutneys', name: 'Chutneys', image: 'assets/img/batch.png' }
    ],
    'home-kitchen': [
      { id: 'meals', name: 'Meals', image: 'assets/img/fresh.png' },
      { id: 'snacks', name: 'Snacks', image: 'assets/img/cup.png' },
      { id: 'sweets', name: 'Sweets', image: 'assets/img/flower.png' }
    ],
    bakery: [
      { id: 'breads', name: 'Breads', image: 'assets/img/fresh.png' },
      { id: 'cakes', name: 'Cakes', image: 'assets/img/cup.png' },
      { id: 'cookies', name: 'Cookies', image: 'assets/img/flower.png' }
    ],
    spices: [
      { id: 'masalas', name: 'Masalas', image: 'assets/img/fresh.png' },
      { id: 'whole-spices', name: 'Whole Spices', image: 'assets/img/cup.png' }
    ],
    snacks: [
      { id: 'savory', name: 'Savory', image: 'assets/img/fresh.png' },
      { id: 'sweets', name: 'Sweets', image: 'assets/img/cup.png' }
    ],
    dairy: [
      { id: 'milk', name: 'Milk Products', image: 'assets/img/fresh.png' },
      { id: 'curd', name: 'Curd & Paneer', image: 'assets/img/cup.png' }
    ],
    organic: [
      { id: 'veggies', name: 'Vegetables', image: 'assets/img/fresh.png' },
      { id: 'fruits', name: 'Fruits', image: 'assets/img/cup.png' }
    ],
    crafts: [
      { id: 'decor', name: 'Home Decor', image: 'assets/img/flower.png' },
      { id: 'gifts', name: 'Gift Items', image: 'assets/img/batch.png' }
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
   * Default static demo storefront (store.html).
   * Sai Ram Home Foods with local logo + marketing banner assets.
   */
  function seedStaticStorefront() {
    var draft = seedSaiRamDraft();
    draft.isStatic = true;
    draft.addresses = [
      {
        id: 'home',
        label: 'Home',
        line: 'Near Latif Hospital, Guntur, Andhra Pradesh 522001'
      },
      {
        id: 'work',
        label: 'Work',
        line: 'Brodipet Main Road, Guntur, Andhra Pradesh 522002'
      }
    ];
    draft.settings.address = draft.addresses[0].line;
    draft.settings.addressWork = draft.addresses[1].line;
    draft.settings.richBanner = true;
    return draft;
  }

  /** Sample storefront: Sai Ram Home Foods */
  function seedSaiRamDraft() {
    var logo = 'assets/img/vendors/sai-ram-home-foods-logo.png';
    var banner = 'assets/img/vendors/sai-ram-home-foods-banner.png';
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
        image: opts.image || logo,
        color: opts.color || PRODUCT_COLORS[0],
        order: opts.order,
        categoryId: opts.categoryId,
        rating: opts.rating || 4.6,
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
      phone: '9876543210',
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
        whatsapp: '9876543210',
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

  /** @deprecated Use seedStaticStorefront */
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
      phone: '9876543210',
      verified: true,
      businessType: 'pickles',
      categories: [
        { id: 'pickles', name: 'Pickles', image: 'assets/img/fresh.png' },
        { id: 'combo-packs', name: 'Combo Packs', image: 'assets/img/cup.png' }
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
        whatsapp: '9876543210',
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
