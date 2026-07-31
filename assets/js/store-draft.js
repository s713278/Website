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

  function emptyDraft() {
    return {
      phone: '',
      verified: false,
      businessType: '',
      categories: [],
      products: [],
      settings: {
        storeName: '',
        tagline: '',
        location: '',
        whatsapp: '',
        logo: '',
        banner: ''
      },
      slug: '',
      currentStep: 1,
      maxReachedStep: 1
    };
  }

  /** Seed matching the mock: Anitha Homemade Pickles */
  function seedPickleDraft() {
    var products = [
      { name: 'Mango Pickle', color: PRODUCT_COLORS[0] },
      { name: 'Gongura Pickle', color: PRODUCT_COLORS[1] },
      { name: 'Lemon Pickle', color: PRODUCT_COLORS[2] },
      { name: 'Garlic Pickle', color: PRODUCT_COLORS[3] },
      { name: 'Mixed Veg Pickle', color: PRODUCT_COLORS[4] },
      { name: 'Avakaya Special', color: PRODUCT_COLORS[5] }
    ].map(function (p, i) {
      return {
        id: uid('prod'),
        name: p.name,
        image: '',
        color: p.color,
        order: i,
        categoryId: 'pickles',
        variants: [
          { id: uid('sku'), label: '250g', price: 189 + i * 10, stock: 40 - i * 2 },
          { id: uid('sku'), label: '500g', price: 349 + i * 15, stock: 25 - i },
          { id: uid('sku'), label: '1kg', price: 599 + i * 20, stock: 12 }
        ].slice(0, i === 0 ? 3 : i < 3 ? 2 : 3)
      };
    });

    // Ensure ~15 SKUs across products
    var skuCount = products.reduce(function (n, p) {
      return n + p.variants.length;
    }, 0);
    if (skuCount < 15) {
      products.forEach(function (p) {
        if (p.variants.length < 3) {
          p.variants.push({
            id: uid('sku'),
            label: '1kg',
            price: 599,
            stock: 10
          });
        }
      });
    }

    return {
      phone: '9876543210',
      verified: true,
      businessType: 'pickles',
      categories: [
        { id: 'pickles', name: 'Pickles', image: 'assets/img/fresh.png' },
        { id: 'combo-packs', name: 'Combo Packs', image: 'assets/img/cup.png' }
      ],
      products: products,
      settings: {
        storeName: 'Anitha Homemade Pickles',
        tagline: 'Traditional • Natural • Homemade',
        location: 'Hyderabad, Telangana',
        whatsapp: '9876543210',
        logo: '',
        banner: ''
      },
      slug: 'anitha-homemade-pickles',
      currentStep: 1,
      maxReachedStep: 1
    };
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyDraft();
      var data = JSON.parse(raw);
      return Object.assign(emptyDraft(), data, {
        settings: Object.assign(emptyDraft().settings, data.settings || {})
      });
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
    return Math.min.apply(
      null,
      product.variants.map(function (v) {
        return Number(v.price) || 0;
      })
    );
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
    uid: uid,
    slugify: slugify,
    emptyDraft: emptyDraft,
    seedPickleDraft: seedPickleDraft,
    loadDraft: loadDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    countSkus: countSkus,
    minPrice: minPrice,
    categoriesForBusiness: categoriesForBusiness,
    whatsappLink: whatsappLink
  };
})(typeof window !== 'undefined' ? window : this);
