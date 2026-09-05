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
      { id: 'pickles', name: 'Pickles', image: IMG.fallbacks.fresh, measurement: 'WEIGHT' },
      { id: 'combo-packs', name: 'Combo Packs', image: IMG.fallbacks.cup, measurement: 'COUNT' },
      { id: 'powders', name: 'Powders', image: IMG.fallbacks.flower, measurement: 'WEIGHT' },
      { id: 'chutneys', name: 'Chutneys', image: IMG.fallbacks.batch, measurement: 'WEIGHT' }
    ],
    'home-kitchen': [
      { id: 'meals', name: 'Meals', image: IMG.fallbacks.fresh, measurement: 'COUNT' },
      { id: 'snacks', name: 'Snacks', image: IMG.fallbacks.cup, measurement: 'WEIGHT' },
      { id: 'sweets', name: 'Sweets', image: IMG.fallbacks.flower, measurement: 'WEIGHT' }
    ],
    bakery: [
      { id: 'breads', name: 'Breads', image: IMG.fallbacks.fresh, measurement: 'COUNT' },
      { id: 'cakes', name: 'Cakes', image: IMG.fallbacks.cup, measurement: 'COUNT' },
      { id: 'cookies', name: 'Cookies', image: IMG.fallbacks.flower, measurement: 'WEIGHT' }
    ],
    spices: [
      { id: 'masalas', name: 'Masalas', image: IMG.fallbacks.fresh, measurement: 'WEIGHT' },
      { id: 'whole-spices', name: 'Whole Spices', image: IMG.fallbacks.cup, measurement: 'WEIGHT' }
    ],
    snacks: [
      { id: 'savory', name: 'Savory', image: IMG.fallbacks.fresh, measurement: 'WEIGHT' },
      { id: 'sweets', name: 'Sweets', image: IMG.fallbacks.cup, measurement: 'WEIGHT' }
    ],
    dairy: [
      { id: 'milk', name: 'Milk Products', image: IMG.fallbacks.fresh, measurement: 'VOLUME' },
      { id: 'curd', name: 'Curd & Paneer', image: IMG.fallbacks.cup, measurement: 'WEIGHT' }
    ],
    organic: [
      { id: 'veggies', name: 'Vegetables', image: IMG.fallbacks.fresh, measurement: 'WEIGHT' },
      { id: 'fruits', name: 'Fruits', image: IMG.fallbacks.cup, measurement: 'WEIGHT' }
    ],
    crafts: [
      { id: 'decor', name: 'Home Decor', image: IMG.fallbacks.flower, measurement: 'COUNT' },
      { id: 'gifts', name: 'Gift Items', image: IMG.fallbacks.batch, measurement: 'COUNT' }
    ],
    florist: [
      { id: 'bouquets', name: 'Bouquets', image: IMG.fallbacks.flower, measurement: 'COUNT' },
      { id: 'plants', name: 'Plants', image: IMG.fallbacks.fresh, measurement: 'COUNT' }
    ],
    clothing: [
      { id: 'women', name: 'Women', image: IMG.fallbacks.cup, measurement: 'COUNT' },
      { id: 'men', name: 'Men', image: IMG.fallbacks.batch, measurement: 'COUNT' }
    ],
    jewellery: [
      { id: 'earrings', name: 'Earrings', image: IMG.fallbacks.flower, measurement: 'COUNT' },
      { id: 'necklaces', name: 'Necklaces', image: IMG.fallbacks.cup, measurement: 'COUNT' }
    ],
    beauty: [
      { id: 'skincare', name: 'Skincare', image: IMG.fallbacks.fresh, measurement: 'VOLUME' },
      { id: 'makeup', name: 'Makeup', image: IMG.fallbacks.flower, measurement: 'COUNT' }
    ],
    stationery: [
      { id: 'notebooks', name: 'Notebooks', image: IMG.fallbacks.batch, measurement: 'COUNT' },
      { id: 'gifts', name: 'Gift Sets', image: IMG.fallbacks.cup, measurement: 'COUNT' }
    ],
    electronics: [
      { id: 'accessories', name: 'Accessories', image: IMG.fallbacks.cup, measurement: 'COUNT' },
      { id: 'gadgets', name: 'Gadgets', image: IMG.fallbacks.batch, measurement: 'COUNT' }
    ],
    pets: [
      { id: 'pet-food', name: 'Pet Food', image: IMG.fallbacks.fresh, measurement: 'WEIGHT' },
      { id: 'pet-care', name: 'Pet Care', image: IMG.fallbacks.cup, measurement: 'COUNT' }
    ],
    grocery: [
      { id: 'staples', name: 'Staples', image: IMG.fallbacks.fresh, measurement: 'WEIGHT' },
      { id: 'daily', name: 'Daily Needs', image: IMG.fallbacks.cup, measurement: 'WEIGHT' }
    ],
    meat: [
      { id: 'chicken', name: 'Chicken', image: IMG.fallbacks.fresh, measurement: 'WEIGHT' },
      { id: 'seafood', name: 'Seafood', image: IMG.fallbacks.cup, measurement: 'WEIGHT' }
    ],
    others: [
      { id: 'general', name: 'General', image: IMG.fallbacks.fresh, measurement: 'COUNT' },
      { id: 'bestsellers', name: 'Bestsellers', image: IMG.fallbacks.cup, measurement: 'COUNT' },
      { id: 'new-arrivals', name: 'New Arrivals', image: IMG.fallbacks.flower, measurement: 'COUNT' }
    ]
  };

  function catProd(id, name, icon) {
    return { id: id, name: name, icon: icon };
  }

  /** Platform products by business type → category. Assigned to the vendor on select. */
  var PRODUCT_CATALOG = {
    'home-kitchen': {
      meals: [
        catProd('home-kitchen__meals__veg-thali', 'Veg Thali', '🍛'),
        catProd('home-kitchen__meals__chicken-curry-meal', 'Chicken Curry Meal', '🍗'),
        catProd('home-kitchen__meals__millet-power-bowl', 'Millet Power Bowl', '🥗'),
        catProd('home-kitchen__meals__tiffin-combo', 'Tiffin Combo', '🍱')
      ],
      snacks: [
        catProd('home-kitchen__snacks__murukku', 'Murukku', '🥨'),
        catProd('home-kitchen__snacks__mixture', 'Mixture', '🥜'),
        catProd('home-kitchen__snacks__banana-chips', 'Banana Chips', '🍌')
      ],
      sweets: [
        catProd('home-kitchen__sweets__millet-laddu', 'Millet Laddu', '🍬'),
        catProd('home-kitchen__sweets__besan-laddu', 'Besan Laddu', '🍯'),
        catProd('home-kitchen__sweets__coconut-barfi', 'Coconut Barfi', '🥥')
      ]
    },
    pickles: {
      pickles: [
        catProd('pickles__pickles__mango', 'Mango Pickle', '🥭'),
        catProd('pickles__pickles__gongura', 'Gongura Pickle', '🌿'),
        catProd('pickles__pickles__lemon', 'Lemon Pickle', '🍋'),
        catProd('pickles__pickles__garlic', 'Garlic Pickle', '🧄')
      ],
      'combo-packs': [
        catProd('pickles__combo-packs__trio', 'Pickle Trio Combo', '🎁'),
        catProd('pickles__combo-packs__family', 'Family Combo Pack', '📦'),
        catProd('pickles__combo-packs__gift-box', 'Gift Box', '🎀')
      ],
      powders: [
        catProd('pickles__powders__karam-podi', 'Karam Podi', '🌶️'),
        catProd('pickles__powders__idli-podi', 'Idli Podi', '🥄'),
        catProd('pickles__powders__kandi-podi', 'Kandi Podi', '🫘'),
        catProd('pickles__powders__karivepaku', 'Karivepaku Kaaram', '🍃')
      ],
      chutneys: [
        catProd('pickles__chutneys__coconut', 'Coconut Chutney', '🥥'),
        catProd('pickles__chutneys__tomato', 'Tomato Chutney', '🍅'),
        catProd('pickles__chutneys__ginger', 'Ginger Chutney', '🫚')
      ]
    },
    bakery: {
      breads: [
        catProd('bakery__breads__sandwich', 'Sandwich Bread', '🍞'),
        catProd('bakery__breads__multigrain', 'Multigrain Loaf', '🌾'),
        catProd('bakery__breads__pav', 'Pav Buns', '🥐')
      ],
      cakes: [
        catProd('bakery__cakes__chocolate', 'Chocolate Cake', '🎂'),
        catProd('bakery__cakes__butterscotch', 'Butterscotch Cake', '🍰'),
        catProd('bakery__cakes__cupcakes', 'Cupcakes', '🧁')
      ],
      cookies: [
        catProd('bakery__cookies__butter', 'Butter Cookies', '🍪'),
        catProd('bakery__cookies__jeera', 'Jeera Biscuits', '🥨'),
        catProd('bakery__cookies__choco-chip', 'Chocolate Chip Cookies', '🍫')
      ]
    },
    spices: {
      masalas: [
        catProd('spices__masalas__garam', 'Garam Masala', '🌶️'),
        catProd('spices__masalas__sambar', 'Sambar Powder', '🥄'),
        catProd('spices__masalas__biryani', 'Biryani Masala', '🍛'),
        catProd('spices__masalas__rasam', 'Rasam Powder', '🥣')
      ],
      'whole-spices': [
        catProd('spices__whole-spices__cardamom', 'Green Cardamom', '🟢'),
        catProd('spices__whole-spices__cloves', 'Cloves', '🟤'),
        catProd('spices__whole-spices__cinnamon', 'Cinnamon Sticks', '🪵')
      ]
    },
    snacks: {
      savory: [
        catProd('snacks__savory__mixture', 'Namkeen Mixture', '🥨'),
        catProd('snacks__savory__murukku', 'Murukku', '🥨'),
        catProd('snacks__savory__thattai', 'Thattai', '🍘')
      ],
      sweets: [
        catProd('snacks__sweets__mysore-pak', 'Mysore Pak', '🍬'),
        catProd('snacks__sweets__laddu', 'Besan Laddu', '🍯'),
        catProd('snacks__sweets__halwa', 'Carrot Halwa', '🥕')
      ]
    },
    dairy: {
      milk: [
        catProd('dairy__milk__toned', 'Toned Milk', '🥛'),
        catProd('dairy__milk__ghee', 'Cow Ghee', '🧈'),
        catProd('dairy__milk__buttermilk', 'Buttermilk', '🥤')
      ],
      curd: [
        catProd('dairy__curd__fresh-curd', 'Fresh Curd', '🥣'),
        catProd('dairy__curd__paneer', 'Malai Paneer', '🧀'),
        catProd('dairy__curd__hung-curd', 'Hung Curd', '🥛')
      ]
    },
    organic: {
      veggies: [
        catProd('organic__veggies__tomato', 'Organic Tomato', '🍅'),
        catProd('organic__veggies__spinach', 'Palak / Spinach', '🥬'),
        catProd('organic__veggies__carrot', 'Farm Carrot', '🥕')
      ],
      fruits: [
        catProd('organic__fruits__banana', 'Farm Banana', '🍌'),
        catProd('organic__fruits__mango', 'Seasonal Mango', '🥭'),
        catProd('organic__fruits__apple', 'Apple', '🍎')
      ]
    },
    crafts: {
      decor: [
        catProd('crafts__decor__wall-hanging', 'Wall Hanging', '🖼️'),
        catProd('crafts__decor__diya-set', 'Diya Set', '🪔'),
        catProd('crafts__decor__cushion', 'Handloom Cushion', '🧵')
      ],
      gifts: [
        catProd('crafts__gifts__gift-hamper', 'Gift Hamper', '🎁'),
        catProd('crafts__gifts__handmade-card', 'Handmade Card', '💌'),
        catProd('crafts__gifts__keychain', 'Craft Keychain', '🔑')
      ]
    },
    florist: {
      bouquets: [
        catProd('florist__bouquets__rose', 'Rose Bouquet', '🌹'),
        catProd('florist__bouquets__mixed', 'Mixed Bouquet', '💐'),
        catProd('florist__bouquets__garland', 'Jasmine Garland', '🌼')
      ],
      plants: [
        catProd('florist__plants__money-plant', 'Money Plant', '🪴'),
        catProd('florist__plants__tulsi', 'Tulsi Plant', '🌿'),
        catProd('florist__plants__snake-plant', 'Snake Plant', '🌱')
      ]
    },
    clothing: {
      women: [
        catProd('clothing__women__kurti', 'Cotton Kurti', '👗'),
        catProd('clothing__women__saree', 'Handloom Saree', '🧵'),
        catProd('clothing__women__dupatta', 'Dupatta', '🧣')
      ],
      men: [
        catProd('clothing__men__shirt', 'Casual Shirt', '👔'),
        catProd('clothing__men__kurta', 'Cotton Kurta', '👕'),
        catProd('clothing__men__dhoti', 'Dhoti', '🩳')
      ]
    },
    jewellery: {
      earrings: [
        catProd('jewellery__earrings__jhumka', 'Jhumka Earrings', '💎'),
        catProd('jewellery__earrings__studs', 'Gold-plated Studs', '✨'),
        catProd('jewellery__earrings__hoops', 'Hoop Earrings', '⭕')
      ],
      necklaces: [
        catProd('jewellery__necklaces__chain', 'Pendant Chain', '📿'),
        catProd('jewellery__necklaces__choker', 'Temple Choker', '💍'),
        catProd('jewellery__necklaces__mangalsutra', 'Mangalsutra', '🟡')
      ]
    },
    beauty: {
      skincare: [
        catProd('beauty__skincare__face-pack', 'Herbal Face Pack', '🌿'),
        catProd('beauty__skincare__oil', 'Coconut Hair Oil', '🧴'),
        catProd('beauty__skincare__soap', 'Handmade Soap', '🧼')
      ],
      makeup: [
        catProd('beauty__makeup__kajal', 'Kajal', '✒️'),
        catProd('beauty__makeup__lipstick', 'Lipstick', '💄'),
        catProd('beauty__makeup__bindi', 'Bindi Pack', '🔴')
      ]
    },
    stationery: {
      notebooks: [
        catProd('stationery__notebooks__ruled', 'Ruled Notebook', '📓'),
        catProd('stationery__notebooks__diary', 'Hardcover Diary', '📔'),
        catProd('stationery__notebooks__sticky', 'Sticky Notes', '📝')
      ],
      gifts: [
        catProd('stationery__gifts__pen-set', 'Pen Gift Set', '✒️'),
        catProd('stationery__gifts__art-kit', 'Art Kit', '🎨'),
        catProd('stationery__gifts__bookmark', 'Bookmark Set', '🔖')
      ]
    },
    electronics: {
      accessories: [
        catProd('electronics__accessories__earphones', 'Wired Earphones', '🎧'),
        catProd('electronics__accessories__charger', 'Phone Charger', '🔌'),
        catProd('electronics__accessories__case', 'Phone Case', '📱')
      ],
      gadgets: [
        catProd('electronics__gadgets__power-bank', 'Power Bank', '🔋'),
        catProd('electronics__gadgets__trimmer', 'Trimmer', '🪒'),
        catProd('electronics__gadgets__led-lamp', 'LED Lamp', '💡')
      ]
    },
    pets: {
      'pet-food': [
        catProd('pets__pet-food__dog-kibble', 'Dog Kibble', '🐶'),
        catProd('pets__pet-food__cat-food', 'Cat Food', '🐱'),
        catProd('pets__pet-food__treats', 'Pet Treats', '🦴')
      ],
      'pet-care': [
        catProd('pets__pet-care__shampoo', 'Pet Shampoo', '🧴'),
        catProd('pets__pet-care__collar', 'Collar & Leash', '🦮'),
        catProd('pets__pet-care__bowl', 'Feeding Bowl', '🥣')
      ]
    },
    grocery: {
      staples: [
        catProd('grocery__staples__rice', 'Sona Masoori Rice', '🍚'),
        catProd('grocery__staples__toor-dal', 'Toor Dal', '🫘'),
        catProd('grocery__staples__atta', 'Wheat Atta', '🌾')
      ],
      daily: [
        catProd('grocery__daily__oil', 'Groundnut Oil', '🫒'),
        catProd('grocery__daily__sugar', 'Sugar', '🧂'),
        catProd('grocery__daily__tea', 'Tea Dust', '🍵')
      ]
    },
    meat: {
      chicken: [
        catProd('meat__chicken__curry-cut', 'Curry Cut Chicken', '🍗'),
        catProd('meat__chicken__boneless', 'Boneless Chicken', '🍖'),
        catProd('meat__chicken__eggs', 'Farm Eggs', '🥚')
      ],
      seafood: [
        catProd('meat__seafood__rohu', 'Rohu Fish', '🐟'),
        catProd('meat__seafood__prawns', 'Prawns', '🦐'),
        catProd('meat__seafood__crab', 'Crab', '🦀')
      ]
    },
    others: {
      general: [
        catProd('others__general__starter', 'Starter Item', '📦'),
        catProd('others__general__daily', 'Daily Essential', '🛒'),
        catProd('others__general__custom', 'Custom Product', '✨')
      ],
      bestsellers: [
        catProd('others__bestsellers__house-special', 'House Special', '⭐'),
        catProd('others__bestsellers__most-ordered', 'Most Ordered', '🔥'),
        catProd('others__bestsellers__combo', 'Combo Deal', '🎁')
      ],
      'new-arrivals': [
        catProd('others__new-arrivals__this-week', "This Week's New", '🆕'),
        catProd('others__new-arrivals__limited', 'Limited Batch', '⏳'),
        catProd('others__new-arrivals__seasonal', 'Seasonal Pick', '🍂')
      ]
    }
  };

  var PRODUCT_COLORS = [
    '#FEF3C7', '#FECACA', '#D1FAE5', '#DBEAFE', '#E9D5FF', '#FFEDD5'
  ];

  /**
   * Platform measurements + units (mirrors /v1/measurements).
   * Product picks a measurement; Set Prices only offers that measurement's units.
   */
  var MEASUREMENTS = [
    {
      id: 'WEIGHT',
      label: 'Weight',
      units: [
        { id: 'g', label: 'g' },
        { id: 'kg', label: 'kg' }
      ],
      defaultUnit: 'g',
      defaultValue: '250',
      presets: [
        { value: '250', unit: 'g' },
        { value: '500', unit: 'g' },
        { value: '1', unit: 'kg' }
      ]
    },
    {
      id: 'VOLUME',
      label: 'Volume',
      units: [
        { id: 'ml', label: 'ml' },
        { id: 'L', label: 'L' }
      ],
      defaultUnit: 'ml',
      defaultValue: '500',
      presets: [
        { value: '250', unit: 'ml' },
        { value: '500', unit: 'ml' },
        { value: '1', unit: 'L' }
      ]
    },
    {
      id: 'COUNT',
      label: 'Count',
      units: [
        { id: 'pcs', label: 'pcs' },
        { id: 'pack', label: 'pack' },
        { id: 'dozen', label: 'dozen' }
      ],
      defaultUnit: 'pcs',
      defaultValue: '1',
      presets: [
        { value: '1', unit: 'pcs' },
        { value: '2', unit: 'pcs' },
        { value: '6', unit: 'pcs' }
      ]
    },
    {
      id: 'AREA',
      label: 'Area',
      units: [
        { id: 'sqft', label: 'sq ft' },
        { id: 'sqm', label: 'sq m' }
      ],
      defaultUnit: 'sqft',
      defaultValue: '1',
      presets: [
        { value: '1', unit: 'sqft' },
        { value: '10', unit: 'sqft' }
      ]
    },
    {
      id: 'SERVICE_UNIT',
      label: 'Service',
      units: [
        { id: 'session', label: 'session' },
        { id: 'visit', label: 'visit' }
      ],
      defaultUnit: 'session',
      defaultValue: '1',
      presets: [
        { value: '1', unit: 'session' },
        { value: '5', unit: 'session' }
      ]
    },
    {
      id: 'DURATION',
      label: 'Duration',
      units: [
        { id: 'min', label: 'min' },
        { id: 'hr', label: 'hr' },
        { id: 'day', label: 'day' }
      ],
      defaultUnit: 'min',
      defaultValue: '30',
      presets: [
        { value: '30', unit: 'min' },
        { value: '1', unit: 'hr' }
      ]
    },
    {
      id: 'PER_PERSON',
      label: 'Per person',
      units: [{ id: 'person', label: 'person' }],
      defaultUnit: 'person',
      defaultValue: '1',
      presets: [{ value: '1', unit: 'person' }]
    },
    {
      id: 'SLOT',
      label: 'Slot',
      units: [{ id: 'slot', label: 'slot' }],
      defaultUnit: 'slot',
      defaultValue: '1',
      presets: [{ value: '1', unit: 'slot' }]
    }
  ];

  var UNIT_ALIASES = {
    g: 'g',
    gm: 'g',
    gms: 'g',
    grms: 'g',
    gram: 'g',
    grams: 'g',
    kg: 'kg',
    kgs: 'kg',
    kilo: 'kg',
    ml: 'ml',
    l: 'L',
    ltr: 'L',
    litre: 'L',
    liter: 'L',
    pcs: 'pcs',
    pc: 'pcs',
    piece: 'pcs',
    pieces: 'pcs',
    pack: 'pack',
    dozen: 'dozen',
    sqft: 'sqft',
    sqm: 'sqm',
    session: 'session',
    visit: 'visit',
    min: 'min',
    hr: 'hr',
    day: 'day',
    person: 'person',
    slot: 'slot'
  };

  var UNIT_SCALE_MAP = {
    g: 'ml',
    kg: 'L',
    ml: 'g',
    L: 'kg'
  };

  var WEIGHT_BUSINESS_TYPES = {
    pickles: true,
    spices: true,
    snacks: true,
    organic: true,
    grocery: true,
    meat: true,
    pets: true
  };

  var VOLUME_BUSINESS_TYPES = {
    dairy: true
  };

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9);
  }

  var STORE_SLUG_MAX = 40;

  function normalizeStoreSlug(raw, opts) {
    var keepTrailing = opts && opts.keepTrailing;
    var s = String(raw || '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-');
    if (keepTrailing) s = s.replace(/^-/, '');
    else s = s.replace(/^-|-$/g, '');
    return s.slice(0, STORE_SLUG_MAX);
  }

  function slugify(text) {
    return normalizeStoreSlug(text) || 'my-store';
  }

  function getMeasurement(id) {
    var found = null;
    MEASUREMENTS.forEach(function (m) {
      if (m.id === id) found = m;
    });
    return found || MEASUREMENTS[0];
  }

  function unitsForMeasurement(id) {
    return getMeasurement(id).units.slice();
  }

  function defaultMeasurementForBusiness(businessTypeId) {
    var id = String(businessTypeId || '');
    if (VOLUME_BUSINESS_TYPES[id]) return 'VOLUME';
    if (WEIGHT_BUSINESS_TYPES[id]) return 'WEIGHT';
    return 'COUNT';
  }

  function inferMeasurementType(name, category, businessTypeId) {
    var hay = String(name || '').toLowerCase();
    if (
      /\b(milk|buttermilk|lassi|juice|oil|shampoo|tonic|drink)\b/.test(hay)
    ) {
      return 'VOLUME';
    }
    if (
      /\b(ghee|paneer|curd|dal|pulse|pulses|rice|atta|flour|sugar|pickle|powder|masala|tea|chips|mixture)\b/.test(
        hay
      )
    ) {
      return 'WEIGHT';
    }
    if (
      /\b(thali|meal|combo|bouquet|shirt|kurti|saree|cake|loaf|plant|egg)\b/.test(hay)
    ) {
      return 'COUNT';
    }
    if (category && category.measurement) return category.measurement;
    return defaultMeasurementForBusiness(businessTypeId);
  }

  function formatSkuLabel(value, unit) {
    var v = String(value == null ? '' : value).trim();
    var u = String(unit || '').trim();
    if (!v && !u) return '';
    if (!u) return v;
    if (!v) return u;
    return v + ' ' + u;
  }

  function parseSkuLabel(label) {
    var s = String(label || '').trim();
    var m = s.match(/^([\d]+(?:[.,]\d+)?)\s*([a-zA-Z]+)?/);
    if (!m) return { value: '', unit: '' };
    return { value: m[1].replace(',', '.'), unit: m[2] || '' };
  }

  function normalizeUnitId(raw, measurementId) {
    var key = String(raw || '').trim();
    var mapped = UNIT_ALIASES[key.toLowerCase()] || key;
    var units = unitsForMeasurement(measurementId);
    var match = null;
    units.forEach(function (u) {
      if (
        u.id === mapped ||
        u.id.toLowerCase() === key.toLowerCase() ||
        String(u.label || '').toLowerCase() === key.toLowerCase()
      ) {
        match = u;
      }
    });
    if (match) return match.id;
    var scaled = UNIT_SCALE_MAP[mapped];
    if (scaled) {
      units.forEach(function (u) {
        if (u.id === scaled) match = u;
      });
      if (match) return match.id;
    }
    return getMeasurement(measurementId).defaultUnit;
  }

  function composeVariantLabel(variant) {
    if (!variant) return '';
    variant.label = formatSkuLabel(variant.value, variant.unit);
    return variant.label;
  }

  function createSkuVariant(opts) {
    opts = opts || {};
    var m = getMeasurement(opts.measurementType);
    var value =
      opts.value != null && String(opts.value).trim() !== ''
        ? String(opts.value).trim()
        : m.defaultValue;
    var unit = normalizeUnitId(opts.unit || m.defaultUnit, m.id);
    var variant = {
      id: opts.id || uid('sku'),
      value: value,
      unit: unit,
      label: formatSkuLabel(value, unit),
      price: opts.price != null ? opts.price : 199,
      mrp: opts.mrp != null ? opts.mrp : 249,
      active: opts.active !== false
    };
    return variant;
  }

  function alignVariantToMeasurement(variant, measurementType) {
    if (!variant) return variant;
    var parsed = parseSkuLabel(variant.label);
    if (variant.value == null || String(variant.value).trim() === '') {
      variant.value = parsed.value || getMeasurement(measurementType).defaultValue;
    }
    variant.unit = normalizeUnitId(variant.unit || parsed.unit, measurementType);
    composeVariantLabel(variant);
    return variant;
  }

  function nextSkuPreset(product) {
    var m = getMeasurement(product && product.measurementType);
    var used = {};
    ((product && product.variants) || []).forEach(function (v) {
      used[String(v.value) + '|' + v.unit] = true;
    });
    var i;
    for (i = 0; i < m.presets.length; i++) {
      var preset = m.presets[i];
      if (!used[preset.value + '|' + preset.unit]) {
        return createSkuVariant({
          measurementType: m.id,
          value: preset.value,
          unit: preset.unit,
          price: '',
          mrp: '',
          active: true
        });
      }
    }
    return createSkuVariant({
      measurementType: m.id,
      value: '',
      unit: m.defaultUnit,
      price: '',
      mrp: '',
      active: true
    });
  }

  function applyMeasurementToProduct(product, measurementType) {
    if (!product) return product;
    product.measurementType = getMeasurement(measurementType).id;
    (product.variants || []).forEach(function (v) {
      alignVariantToMeasurement(v, product.measurementType);
    });
    return product;
  }

  function normalizeProductMeasurement(product, category, businessTypeId) {
    if (!product) return product;
    if (!product.measurementType) {
      product.measurementType = inferMeasurementType(
        product.name,
        category,
        businessTypeId
      );
    } else {
      product.measurementType = getMeasurement(product.measurementType).id;
    }
    (product.variants || []).forEach(function (v) {
      alignVariantToMeasurement(v, product.measurementType);
    });
    if (!(product.variants || []).length) {
      product.variants = [createSkuVariant({ measurementType: product.measurementType })];
    }
    return product;
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
    },
    {
      id: 'inter',
      label: 'Inter',
      hint: 'Neutral',
      display: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
      body: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"
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
        description: '',
        location: '',
        whatsapp: '',
        instagramUrl: '',
        logo: '',
        banner: '',
        themeColor: DEFAULT_THEME,
        accentColor: DEFAULT_ACCENT,
        backgroundColor: DEFAULT_BG,
        textColor: '',
        fontId: DEFAULT_FONT,
        buttonShape: 'ROUNDED',
        cardStyle: 'SHADOW',
        themePreset: '',
        heroBadges: [],
        trustStrip: [],
        shareLink: '',
        announcementBar: '',
        welcomeMessage: '',
        whatsappCta: 'Order on WhatsApp',
        paymentNote: '',
        deliveryMessage: '',
        pickupMessage: ''
      },
      slug: '',
      slugCustom: false,
      vendorId: null,
      subscription: defaultSubscription(),
      currentStep: 1,
      maxReachedStep: 1
    };
  }

  /** Drop API placeholders like "string" so broken images never render. */
  function isUsableMediaUrl(value) {
    var s = String(value || '').trim();
    if (!s) return '';
    var lower = s.toLowerCase();
    if (lower === 'string' || lower === 'null' || lower === 'undefined' || lower === 'none' || lower === 'n/a') {
      return '';
    }
    if (
      s.indexOf('http://') === 0 ||
      s.indexOf('https://') === 0 ||
      s.indexOf('data:image') === 0 ||
      s.indexOf('/') === 0 ||
      s.indexOf('assets/') === 0
    ) {
      return s;
    }
    return '';
  }

  function categoryIconForName(name) {
    var n = String(name || '').toLowerCase();
    if (n.indexOf('podi') !== -1 || n.indexOf('spice') !== -1 || n.indexOf('masala') !== -1) return '🌶️';
    if (n.indexOf('herbal') !== -1 || n.indexOf('hair') !== -1) return '🌿';
    if (n.indexOf('flour') !== -1) return '🌾';
    if (n.indexOf('snack') !== -1) return '🥨';
    if (n.indexOf('healthy') !== -1) return '🥗';
    if (n.indexOf('eco') !== -1) return '♻️';
    if (n.indexOf('sweet') !== -1 || n.indexOf('mithai') !== -1) return '🍬';
    if (n.indexOf('pickle') !== -1 || n.indexOf('achar') !== -1) return '🫙';
    return '📦';
  }

  function firstLine(text, maxLen) {
    var raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    var cut = raw.split(/[.!?]/)[0].trim();
    var line = cut || raw;
    var limit = maxLen || 96;
    if (line.length > limit) return line.slice(0, limit - 1).replace(/\s+\S*$/, '') + '…';
    return line;
  }

  /**
   * Map GET /v1/vendors/{id}/storefront (VendorStorefrontResponse) → store draft.
   * Home products are lightweight collection tiles (id, name, image_path) — not SKUs.
   */
  function fromVendorStorefront(raw) {
    var src = raw || {};
    if (src.data && typeof src.data === 'object' && (src.data.business_name || src.data.store_identifier)) {
      src = src.data;
    }
    var draft = emptyDraft();
    var theme = src.theme || {};
    var fulfill = src.fulfillment || {};
    var cats = Array.isArray(src.categories) ? src.categories : [];
    var products = Array.isArray(src.products) ? src.products : [];

    draft.vendorId = src.vendor_id != null ? src.vendor_id : null;
    draft.slug = src.store_identifier || slugify(src.business_name || '');
    draft.verified = !!src.verified;
    draft.phone = String(src.support_whatsapp_number || src.order_whatsapp_number || '').replace(/\D/g, '');
    draft.meta = { source: 'api', version: 1, fetchedAt: new Date().toISOString() };

    draft.settings.storeName = src.business_name || '';
    draft.settings.tagline = src.tagline || firstLine(src.description, 88);
    draft.settings.description = src.description || '';
    draft.settings.location = src.business_location || '';
    draft.settings.whatsapp = src.support_whatsapp_number || src.order_whatsapp_number || '';
    draft.settings.instagramUrl = src.instagram_url || '';
    draft.settings.logo = isUsableMediaUrl(src.logo || src.thumbnail_image || theme.logo_image);
    draft.settings.banner = isUsableMediaUrl(src.banner_image || theme.banner_image);
    draft.settings.richBanner = !!draft.settings.banner;
    draft.settings.themeColor = theme.primary_color || DEFAULT_THEME;
    draft.settings.accentColor = theme.accent_color || DEFAULT_ACCENT;
    draft.settings.backgroundColor = theme.background_color || DEFAULT_BG;
    draft.settings.textColor = theme.text_color || '';
    draft.settings.fontId = fontIdFromFamily(theme.font_family);
    draft.settings.buttonShape = String(theme.button_shape || 'ROUNDED').toUpperCase();
    draft.settings.cardStyle = String(theme.card_style || 'SHADOW').toUpperCase();
    draft.settings.themePreset = String(theme.theme_preset || '').toUpperCase();
    draft.settings.heroBadges = Array.isArray(src.hero_badges) ? src.hero_badges.filter(Boolean) : [];
    draft.settings.trustStrip = Array.isArray(src.trust_strip) ? src.trust_strip : [];
    draft.settings.shareLink = src.share_link || '';
    draft.settings.announcementBar = src.announcement_bar || '';
    draft.settings.welcomeMessage = src.welcome_message || '';
    draft.settings.whatsappCta = src.whatsapp_cta_text || 'Order on WhatsApp';
    draft.settings.paymentNote = src.payment_note || '';
    draft.settings.deliveryMessage = fulfill.delivery_message || '';
    draft.settings.pickupMessage = fulfill.pickup_message || '';

    draft.delivery.homeDelivery.enabled = !!fulfill.home_delivery_available;
    draft.delivery.storePickup.enabled = !!fulfill.store_pickup_available;
    if (!draft.delivery.homeDelivery.enabled && !draft.delivery.storePickup.enabled) {
      draft.delivery.homeDelivery.enabled = true;
    }

    draft.categories = cats.map(function (c, i) {
      return {
        id: String(c.id != null ? c.id : 'cat-' + i),
        name: c.name || 'Category',
        image: isUsableMediaUrl(c.image_path || c.image),
        icon: categoryIconForName(c.name),
        description: c.description || ''
      };
    });

    function categoryIdForProduct(p) {
      if (p.category_id != null && p.category_id !== '') return String(p.category_id);
      var name = String(p.name || '').toLowerCase();
      for (var i = 0; i < draft.categories.length; i++) {
        if (String(draft.categories[i].name || '').toLowerCase() === name) {
          return String(draft.categories[i].id);
        }
      }
      return '';
    }

    draft.products = products.map(function (p, i) {
      var image = isUsableMediaUrl(p.image_path || p.image);
      var variants = Array.isArray(p.variants) ? p.variants : [];
      return {
        id: String(p.id != null ? p.id : 'prod-' + i),
        name: p.name || 'Item',
        image: image,
        icon: categoryIconForName(p.name),
        color: PRODUCT_COLORS[i % PRODUCT_COLORS.length],
        order: i,
        categoryId: categoryIdForProduct(p),
        rating: p.rating || 0,
        reviews: p.reviews || 0,
        description: p.description || '',
        popular: p.popular !== false,
        kind: variants.length ? 'product' : 'collection',
        variants: variants
      };
    });

    draft.categories.forEach(function (c) {
      if (c.image) return;
      var match = draft.products.find(function (p) {
        return (
          p.image &&
          (p.categoryId === c.id || String(p.name || '').toLowerCase() === String(c.name || '').toLowerCase())
        );
      });
      if (match) c.image = match.image;
    });

    return draft;
  }

  function isVendorStorefrontPayload(raw) {
    var src = raw && raw.data && typeof raw.data === 'object' ? raw.data : raw;
    if (!src || typeof src !== 'object') return false;
    if (src.settings && src.settings.storeName) return false;
    return !!(src.business_name || src.store_identifier || (src.vendor_id && src.theme));
  }

  /**
   * Live sample: SVADA public storefront (GET /v1/vendors/1/storefront).
   * Used as the Instagram-bio / WhatsApp-status reference store.
   */
  function seedSvadaApiPayload() {
    return {
      vendor_id: 1,
      store_identifier: 'svad',
      business_name: 'SVADA [Fixed Window]',
      description:
        'A homegrown, farm-to-table brand offering a wide range of traditionally prepared, natural, and chemical-free products rooted in Telugu culinary and wellness heritage. From hand-pounded spice powders, seasonal pickles, and multigrain flours to wild forest honey, herbal hair care, and eco-friendly daily essentials — every product is crafted with care, using authentic recipes passed down through generations.',
      banner_image:
        'https://mithradirect-s3-ap-south-2.s3.ap-south-2.amazonaws.com/vendors/1/homebanners/home_banner_jpeg.jpeg',
      logo: 'https://mithradirect-s3-ap-south-2.s3.ap-south-2.amazonaws.com/vendors/1/thumbnails/logo_jpg.jpeg',
      verified: true,
      theme: {
        primary_color: '#F97316',
        accent_color: '#15803D',
        background_color: '#FFFFFF',
        text_color: '#1F2937',
        font_family: 'Inter',
        button_shape: 'ROUNDED',
        card_style: 'SHADOW',
        theme_preset: 'WARM'
      },
      hero_badges: ['100% Natural', 'No Preservatives', 'Home-style Taste'],
      business_location: 'Hyderabad, Telangana',
      fulfillment: {
        home_delivery_available: true,
        store_pickup_available: false,
        delivery_message: 'Delivery Available'
      },
      categories: [
        { id: 217, name: 'Podi', image_path: 'string' },
        {
          id: 218,
          name: 'Herbal Products',
          image_path: 'https://mithrabucket.s3.ap-south-1.amazonaws.com/images/category/farm_stay.jpg'
        },
        { id: 219, name: 'Flours', image_path: 'string' },
        { id: 220, name: 'Snacks' },
        { id: 221, name: 'Spices', image_path: 'string' },
        { id: 222, name: 'Healthy Foods' },
        { id: 223, name: 'Eco Friendly' },
        {
          id: 224,
          name: 'Sweets',
          image_path: 'https://mithrabucket.s3.ap-south-1.amazonaws.com/images/category/farm_stay.jpg'
        },
        { id: 225, name: 'Pickles', image_path: 'string' }
      ],
      products: [
        {
          id: 161,
          name: 'Eco Friendly',
          image_path:
            'https://mithradirect-s3-ap-south-2.s3.ap-south-2.amazonaws.com/platform/products/all_eco_friendly_products_jpeg.jpeg'
        },
        {
          id: 157,
          name: 'Flours',
          image_path:
            'https://mithradirect-s3-ap-south-2.s3.ap-south-2.amazonaws.com/platform/products/whatsappimage2026-04-30at3_47_12pm_jpeg.jpeg'
        },
        {
          id: 160,
          name: 'Healthy Foods',
          image_path:
            'https://mithradirect-s3-ap-south-2.s3.ap-south-2.amazonaws.com/platform/products/whatsappimage2026-04-30at3_47_11pm2_jpeg.jpeg'
        },
        {
          id: 156,
          name: 'Herbal Products',
          image_path:
            'https://mithradirect-s3-ap-south-2.s3.ap-south-2.amazonaws.com/platform/products/whatsappimage2026-04-30at3_47_10pm_jpeg.jpeg'
        },
        {
          id: 163,
          name: 'Pickles',
          image_path:
            'https://mithradirect-s3-ap-south-2.s3.ap-south-2.amazonaws.com/platform/products/whatsappimage2026-04-30at3_47_10pm1_jpeg.jpeg'
        },
        {
          id: 155,
          name: 'Podi',
          image_path:
            'https://mithradirect-s3-ap-south-2.s3.ap-south-2.amazonaws.com/platform/products/whatsappimage2026-04-30at3_47_10pm2_jpeg.jpeg'
        },
        {
          id: 158,
          name: 'Snacks',
          image_path:
            'https://mithradirect-s3-ap-south-2.s3.ap-south-2.amazonaws.com/platform/products/whatsappimage2026-04-30at3_47_10pm3_jpeg.jpeg'
        },
        {
          id: 159,
          name: 'Spices',
          image_path:
            'https://mithradirect-s3-ap-south-2.s3.ap-south-2.amazonaws.com/platform/products/chatgptimagemay29202606_01_55a_jpeg.jpeg'
        },
        {
          id: 162,
          name: 'Sweets',
          image_path:
            'https://mithradirect-s3-ap-south-2.s3.ap-south-2.amazonaws.com/platform/products/whatsappimage2026-04-30at3_47_11pm1_jpeg.jpeg'
        }
      ],
      trust_strip: [
        { icon: 'shield', title: 'Hygienic & Safe', subtitle: 'Prepared with care' },
        { icon: 'leaf', title: 'Made Fresh Daily', subtitle: 'No compromise' },
        { icon: 'truck', title: 'Quick Delivery', subtitle: 'On-time, every time' },
        { icon: 'lock', title: 'Secure Payments', subtitle: '100% safe & secure' }
      ],
      share_link: '/api/v1/deeplink?vendor_id=1',
      support_whatsapp_number: '+919000955239'
    };
  }

  function seedSvadaDraft() {
    var draft = fromVendorStorefront(seedSvadaApiPayload());
    draft.meta.source = 'seed';
    draft.isStatic = true;
    return draft;
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
        measurementType: 'WEIGHT',
        variants: [
          createSkuVariant({
            measurementType: 'WEIGHT',
            value: '250',
            unit: 'g',
            price: 189 + i * 10,
            mrp: 249 + i * 10
          }),
          createSkuVariant({
            measurementType: 'WEIGHT',
            value: '500',
            unit: 'g',
            price: 349 + i * 15,
            mrp: 449 + i * 15
          }),
          createSkuVariant({
            measurementType: 'WEIGHT',
            value: '1',
            unit: 'kg',
            price: 599 + i * 20,
            mrp: 749 + i * 20
          })
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
        measurementType: 'COUNT',
        variants: [
          createSkuVariant({
            measurementType: 'COUNT',
            value: '3',
            unit: 'pack',
            price: 499 + i * 50,
            mrp: 649 + i * 50
          }),
          createSkuVariant({
            measurementType: 'COUNT',
            value: '5',
            unit: 'pack',
            price: 799 + i * 50,
            mrp: 999 + i * 50
          }),
          createSkuVariant({
            measurementType: 'COUNT',
            value: '1',
            unit: 'pack',
            price: 999 + i * 50,
            mrp: 1299 + i * 50
          })
        ]
      };
    });

    var products = pickleProducts.concat(comboProducts);

    return {
      phone: DEMO_WA,
      verified: true,
      businessType: 'pickles',
      categories: [
        { id: 'pickles', name: 'Pickles', image: IMG.fallbacks.fresh, measurement: 'WEIGHT' },
        { id: 'combo-packs', name: 'Combo Packs', image: IMG.fallbacks.cup, measurement: 'COUNT' }
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
      if (typeof draft.slugCustom !== 'boolean') {
        var autoSlug = slugify(draft.settings.storeName || '');
        draft.slugCustom = !!(
          draft.slug &&
          draft.slug !== autoSlug &&
          draft.slug !== 'my-store'
        );
      }
      if (!draft.slug && draft.settings.storeName) {
        draft.slug = slugify(draft.settings.storeName);
      }
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
    if (draft.settings && draft.settings.storeName && !draft.slugCustom) {
      draft.slug = slugify(draft.settings.storeName);
    } else if (draft.settings && draft.settings.storeName && !String(draft.slug || '').trim()) {
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

  var CATEGORY_PAGE_SIZE = 9;

  /**
   * Simulated GET /v1/business-types/{id}/categories?q=&page=&size=
   * extras: vendor-added custom categories for this business type.
   */
  function fetchCategoriesPage(opts) {
    opts = opts || {};
    var page = Math.max(1, Number(opts.page) || 1);
    var size = Math.max(1, Number(opts.size) || CATEGORY_PAGE_SIZE);
    var q = String(opts.q || '')
      .toLowerCase()
      .trim();
    var extras = Array.isArray(opts.extras) ? opts.extras : [];
    var catalog = categoriesForBusiness(opts.businessTypeId);
    var seen = {};
    var all = [];
    catalog.forEach(function (c) {
      if (!c || !c.id || seen[c.id]) return;
      seen[c.id] = true;
      all.push(c);
    });
    extras.forEach(function (c) {
      if (!c || !c.id || seen[c.id]) return;
      seen[c.id] = true;
      all.push(c);
    });
    var filtered = all.filter(function (c) {
      if (!q) return true;
      var hay = [c.id, c.name || '', c.keywords || ''].join(' ').toLowerCase();
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

  function catalogProductsFor(businessTypeId, categoryId) {
    var byBiz = PRODUCT_CATALOG[businessTypeId] || {};
    return (byBiz[categoryId] || []).slice();
  }

  var PRODUCT_PAGE_SIZE = 3;

  /**
   * Simulated GET /v1/categories/{id}/products?q=&page=&size=
   * extras: vendor-added custom products for this category.
   */
  function fetchCatalogProductsPage(opts) {
    opts = opts || {};
    var page = Math.max(1, Number(opts.page) || 1);
    var size = Math.max(1, Number(opts.size) || PRODUCT_PAGE_SIZE);
    var q = String(opts.q || '')
      .toLowerCase()
      .trim();
    var extras = Array.isArray(opts.extras) ? opts.extras : [];
    var catalog = catalogProductsFor(opts.businessTypeId, opts.categoryId);
    var seen = {};
    var all = [];
    extras.forEach(function (p) {
      if (!p || !p.id || seen[p.id]) return;
      seen[p.id] = true;
      all.push(p);
    });
    catalog.forEach(function (p) {
      if (!p || !p.id || seen[p.id]) return;
      seen[p.id] = true;
      all.push(p);
    });
    var filtered = all.filter(function (p) {
      if (!q) return true;
      return String(p.name || '')
        .toLowerCase()
        .indexOf(q) >= 0;
    });
    var start = (page - 1) * size;
    var items = filtered.slice(start, start + size);
    return {
      items: items,
      page: page,
      size: size,
      total: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / size) || 1),
      hasMore: start + items.length < filtered.length
    };
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

  function fontIdFromFamily(family) {
    var key = String(family || '')
      .toLowerCase()
      .replace(/['"]/g, '')
      .trim();
    if (!key) return DEFAULT_FONT;
    for (var i = 0; i < FONT_PRESETS.length; i++) {
      var p = FONT_PRESETS[i];
      if (p.id === key || String(p.label || '').toLowerCase() === key) return p.id;
      if (key.indexOf(String(p.label || '').toLowerCase()) !== -1) return p.id;
    }
    return DEFAULT_FONT;
  }

  function getFontPreset(fontId) {
    var id = fontIdFromFamily(fontId);
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

    var font = getFontPreset(settings.fontId || settings.fontFamily);
    var shape = String(settings.buttonShape || 'ROUNDED').toUpperCase();
    var card = String(settings.cardStyle || 'SHADOW').toUpperCase();
    var preset = String(settings.themePreset || '').toUpperCase();
    var textRaw = String(settings.textColor || '').trim();
    var textColor = /^#[0-9a-fA-F]{3,6}$/.test(textRaw) ? normalizeHex(textRaw) : '';

    el.style.setProperty('--store-accent', accent);
    el.style.setProperty('--store-accent-soft', hexToRgba(accent, 0.16));
    el.style.setProperty('--store-accent-muted', hexToRgba(accent, 0.28));
    el.setAttribute('data-store-accent', accent);
    el.setAttribute('data-store-font', font.id);
    el.setAttribute('data-store-bg', bg);
    el.setAttribute('data-store-btn', shape);
    el.setAttribute('data-store-card', card);
    if (preset) el.setAttribute('data-store-preset', preset);
    if (typeof document !== 'undefined' && document.body && (surface === 'store' || root)) {
      document.body.setAttribute('data-store-btn', shape);
      document.body.setAttribute('data-store-card', card);
      if (preset) document.body.setAttribute('data-store-preset', preset);
    }

    // Background + ink: storefront canvas; dashboard keeps Mithra atmosphere
    if (surface === 'store' || root) {
      el.style.setProperty('--store-bg', bg);
      if (textColor) {
        el.style.setProperty('--store-ink', textColor);
        el.style.setProperty('--store-muted', hexToRgba(textColor, 0.62));
        el.style.setProperty('--store-border', isDarkHex(bg) ? 'rgba(255,255,255,0.12)' : '#e5e7eb');
        el.style.setProperty('--md-panel-bg', isDarkHex(bg) ? '#1f2937' : '#ffffff');
      } else if (isDarkHex(bg)) {
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
    CATEGORY_PAGE_SIZE: CATEGORY_PAGE_SIZE,
    fetchCategoriesPage: fetchCategoriesPage,
    PRODUCT_PAGE_SIZE: PRODUCT_PAGE_SIZE,
    catalogProductsFor: catalogProductsFor,
    fetchCatalogProductsPage: fetchCatalogProductsPage,
    PRODUCT_COLORS: PRODUCT_COLORS,
    MEASUREMENTS: MEASUREMENTS,
    getMeasurement: getMeasurement,
    unitsForMeasurement: unitsForMeasurement,
    defaultMeasurementForBusiness: defaultMeasurementForBusiness,
    inferMeasurementType: inferMeasurementType,
    formatSkuLabel: formatSkuLabel,
    parseSkuLabel: parseSkuLabel,
    normalizeUnitId: normalizeUnitId,
    composeVariantLabel: composeVariantLabel,
    createSkuVariant: createSkuVariant,
    alignVariantToMeasurement: alignVariantToMeasurement,
    nextSkuPreset: nextSkuPreset,
    applyMeasurementToProduct: applyMeasurementToProduct,
    normalizeProductMeasurement: normalizeProductMeasurement,
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
    normalizeStoreSlug: normalizeStoreSlug,
    STORE_SLUG_MAX: STORE_SLUG_MAX,
    normalizeHex: normalizeHex,
    hexToRgba: hexToRgba,
    isLightHex: isLightHex,
    isDarkHex: isDarkHex,
    getFontPreset: getFontPreset,
    applyTheme: applyTheme,
    applyStoreBrand: applyStoreBrand,
    isUsableMediaUrl: isUsableMediaUrl,
    fontIdFromFamily: fontIdFromFamily,
    fromVendorStorefront: fromVendorStorefront,
    isVendorStorefrontPayload: isVendorStorefrontPayload,
    seedSvadaApiPayload: seedSvadaApiPayload,
    seedSvadaDraft: seedSvadaDraft,
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
