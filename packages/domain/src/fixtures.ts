const logo = '/vendors/sai-ram-home-foods-logo.png';
const banner = '/vendors/sai-ram-home-foods-banner.png';

function pickleSkus(prefix: string, base: number) {
  return [
    { id: `${prefix}_250`, label: '250 gms', price: base, mrp: base + 30, active: true },
    { id: `${prefix}_500`, label: '500 gms', price: base * 2 - 20, mrp: base * 2 + 20, active: true },
    { id: `${prefix}_1kg`, label: '1 kg', price: base * 3.5, mrp: base * 4, active: true },
  ];
}

function podiSkus(prefix: string, base: number) {
  return [
    { id: `${prefix}_200`, label: '200 gms', price: base, mrp: base + 20, active: true },
    {
      id: `${prefix}_500`,
      label: '500 gms',
      price: Math.round(base * 2.2),
      mrp: Math.round(base * 2.5),
      active: true,
    },
  ];
}

/** Sai Ram Home Foods sample catalog (fixture for storefront offline/demo mode). */
export function seedSaiRamDraft() {
  return {
    phone: '9876543210',
    verified: true,
    businessType: 'pickles',
    isSample: true,
    isStatic: true,
    slug: 'sai-ram-home-foods',
    categories: [
      { id: 'veg-pickles', name: 'Veg Pickles', image: logo, icon: '🫙' },
      { id: 'nonveg-pickles', name: 'Non-Veg Pickles', image: logo, icon: '🍗' },
      { id: 'podi', name: 'Kaaram Podulu', image: logo, icon: '🌶️' },
      { id: 'snacks', name: 'Snacks', image: logo, icon: '🥨' },
      { id: 'sweets', name: 'Sweets', image: logo, icon: '🍬' },
    ],
    products: [
      {
        id: 'prod_mango',
        name: 'Mango Pickle',
        categoryId: 'veg-pickles',
        order: 0,
        color: '#FEF3C7',
        image: logo,
        rating: 4.9,
        popular: true,
        description: 'Sun-cured Andhra avakaya-style mango pickle — Amma chethi ruchi, pure & natural.',
        ingredients: 'Raw mango, mustard oil, chilli powder, fenugreek, salt',
        variants: pickleSkus('sku_mango', 160),
      },
      {
        id: 'prod_gongura',
        name: 'Gongura Pickle',
        categoryId: 'veg-pickles',
        order: 1,
        color: '#D1FAE5',
        image: logo,
        rating: 4.8,
        popular: true,
        description: 'Tangy gongura pickle made fresh in small batches with traditional Telugu spices.',
        ingredients: 'Gongura leaves, chilli, garlic, mustard oil, salt',
        variants: pickleSkus('sku_gongura', 150),
      },
      {
        id: 'prod_chicken',
        name: 'Chicken Pickle',
        categoryId: 'nonveg-pickles',
        order: 4,
        color: '#FECACA',
        image: logo,
        rating: 4.8,
        popular: true,
        description: 'Homemade chicken pickle — bold, spicy and packed hygienically.',
        ingredients: 'Chicken, chilli, garlic, ginger, spices, oil',
        variants: pickleSkus('sku_chicken', 280),
      },
      {
        id: 'prod_karam_podi',
        name: 'Kaaram Podi',
        categoryId: 'podi',
        order: 6,
        color: '#FFEDD5',
        image: logo,
        rating: 4.8,
        popular: true,
        description: 'Spicy kaaram podi for rice, idli and dosa — pure taste from home.',
        ingredients: 'Red chilli, roasted dals, garlic, cumin, salt',
        variants: podiSkus('sku_kp', 120),
      },
      {
        id: 'prod_murukku',
        name: 'Janthikalu / Murukku',
        categoryId: 'snacks',
        order: 9,
        color: '#FEF3C7',
        image: logo,
        rating: 4.6,
        popular: true,
        description: 'Crispy homemade murukku — perfect with evening chai.',
        ingredients: 'Rice flour, urad dal flour, butter, cumin, salt',
        variants: [
          { id: 'sku_mur_200', label: '200 gms', price: 90, mrp: 110, active: true },
          { id: 'sku_mur_500', label: '500 gms', price: 200, mrp: 240, active: true },
        ],
      },
      {
        id: 'prod_laddu',
        name: 'Besan Laddu',
        categoryId: 'sweets',
        order: 10,
        color: '#FEF3C7',
        image: logo,
        rating: 4.8,
        popular: true,
        description: 'Soft besan laddus made with ghee and love — festive favourite.',
        ingredients: 'Besan, ghee, sugar, cardamom, cashew',
        variants: [
          { id: 'sku_lad_250', label: '250 gms', price: 180, mrp: 210, active: true },
          { id: 'sku_lad_500', label: '500 gms', price: 340, mrp: 380, active: true },
        ],
      },
    ],
    delivery: {
      storePickup: { enabled: true },
      homeDelivery: { enabled: true, charge: 40 },
      courierDelivery: { enabled: false, charge: 80 },
    },
    payment: {
      upi: { enabled: true, upiId: 'sairam@upi', payeeName: 'Sai Ram Home Foods' },
      bank: { enabled: false },
      cod: { enabled: true },
    },
    settings: {
      storeName: 'Sai Ram Home Foods',
      tagline: 'Authentic taste of tradition',
      location: 'Service area: Guntur, AP',
      whatsapp: '9876543210',
      logo,
      banner,
      themeColor: '#1B5E20',
      address: 'Near Latif Hospital, Guntur, Andhra Pradesh 522001',
    },
    addresses: [
      {
        id: 'home',
        label: 'Home',
        line: 'Near Latif Hospital, Guntur, Andhra Pradesh 522001',
      },
      {
        id: 'work',
        label: 'Work',
        line: 'Brodipet Main Road, Guntur, Andhra Pradesh 522002',
      },
    ],
  };
}
