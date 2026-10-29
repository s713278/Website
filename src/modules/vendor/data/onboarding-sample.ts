import type {
  BusinessTypeReference,
  CategoryReference,
  ProductReference,
  ReferencePage,
} from '@/shared/api'

export const SAMPLE_BUSINESS_TYPES: BusinessTypeReference[] = [
  { id: -101, name: 'Grocery & essentials', icon: null, displayOrder: 1 },
  { id: -102, name: 'Food & beverages', icon: null, displayOrder: 2 },
  { id: -103, name: 'Home-made products', icon: null, displayOrder: 3 },
  { id: -104, name: 'Flowers & gifts', icon: null, displayOrder: 4 },
]

export const SAMPLE_CATEGORIES: CategoryReference[] = [
  { id: -201, businessTypeId: -101, name: 'Fresh produce', description: 'Everyday fruit and vegetables', imageUrl: null, displayOrder: 1 },
  { id: -202, businessTypeId: -101, name: 'Pantry', description: 'Staples, grains, and cooking essentials', imageUrl: null, displayOrder: 2 },
  { id: -203, businessTypeId: -101, name: 'Dairy & breakfast', description: 'Milk, eggs, bread, and morning staples', imageUrl: null, displayOrder: 3 },
  { id: -211, businessTypeId: -102, name: 'Ready to eat', description: 'Meals prepared for quick ordering', imageUrl: null, displayOrder: 1 },
  { id: -212, businessTypeId: -102, name: 'Snacks', description: 'Savoury bites and treats', imageUrl: null, displayOrder: 2 },
  { id: -213, businessTypeId: -102, name: 'Drinks', description: 'Cold and hot beverages', imageUrl: null, displayOrder: 3 },
  { id: -221, businessTypeId: -103, name: 'Pickles & preserves', description: 'Small-batch pantry favourites', imageUrl: null, displayOrder: 1 },
  { id: -222, businessTypeId: -103, name: 'Baked at home', description: 'Cakes, bread, and cookies', imageUrl: null, displayOrder: 2 },
  { id: -231, businessTypeId: -104, name: 'Fresh flowers', description: 'Bouquets and loose flowers', imageUrl: null, displayOrder: 1 },
  { id: -232, businessTypeId: -104, name: 'Gift boxes', description: 'Curated gifts for every occasion', imageUrl: null, displayOrder: 2 },
]

export const SAMPLE_PRODUCTS_BY_CATEGORY: Record<number, ProductReference[]> = {
  [-201]: [
    { id: -301, name: 'Tomatoes', description: 'Fresh local tomatoes', imageUrl: null, measurementId: null, measurementName: 'WEIGHT' },
    { id: -302, name: 'Bananas', description: 'Naturally ripened bananas', imageUrl: null, measurementId: null, measurementName: 'COUNT' },
    { id: -303, name: 'Leafy greens', description: 'Seasonal greens bundle', imageUrl: null, measurementId: null, measurementName: 'COUNT' },
  ],
  [-202]: [
    { id: -311, name: 'Sona masoori rice', description: 'Everyday rice', imageUrl: null, measurementId: null, measurementName: 'WEIGHT' },
    { id: -312, name: 'Toor dal', description: 'Cleaned pigeon peas', imageUrl: null, measurementId: null, measurementName: 'WEIGHT' },
    { id: -313, name: 'Cold-pressed oil', description: 'Small-batch cooking oil', imageUrl: null, measurementId: null, measurementName: 'VOLUME' },
  ],
  [-203]: [
    { id: -321, name: 'Farm milk', description: 'Fresh whole milk', imageUrl: null, measurementId: null, measurementName: 'VOLUME' },
    { id: -322, name: 'Country eggs', description: 'Tray of fresh eggs', imageUrl: null, measurementId: null, measurementName: 'COUNT' },
  ],
  [-211]: [
    { id: -331, name: 'Vegetable thali', description: 'Complete homestyle meal', imageUrl: null, measurementId: null, measurementName: 'COUNT' },
    { id: -332, name: 'Millet bowl', description: 'Millets and seasonal vegetables', imageUrl: null, measurementId: null, measurementName: 'COUNT' },
  ],
  [-212]: [
    { id: -341, name: 'Masala mixture', description: 'Crisp savoury snack', imageUrl: null, measurementId: null, measurementName: 'WEIGHT' },
    { id: -342, name: 'Baked samosas', description: 'Box of six', imageUrl: null, measurementId: null, measurementName: 'COUNT' },
  ],
  [-213]: [
    { id: -351, name: 'Fresh lime soda', description: 'Made to order', imageUrl: null, measurementId: null, measurementName: 'VOLUME' },
    { id: -352, name: 'Cold coffee', description: 'Chilled and lightly sweetened', imageUrl: null, measurementId: null, measurementName: 'VOLUME' },
  ],
  [-221]: [
    { id: -361, name: 'Mango pickle', description: 'Traditional family recipe', imageUrl: null, measurementId: null, measurementName: 'WEIGHT' },
    { id: -362, name: 'Tomato chutney', description: 'Small-batch preserve', imageUrl: null, measurementId: null, measurementName: 'WEIGHT' },
  ],
  [-222]: [
    { id: -371, name: 'Tea cake', description: 'Soft vanilla loaf', imageUrl: null, measurementId: null, measurementName: 'COUNT' },
    { id: -372, name: 'Butter cookies', description: 'Box of twelve', imageUrl: null, measurementId: null, measurementName: 'COUNT' },
  ],
  [-231]: [
    { id: -381, name: 'Rose bouquet', description: 'Twelve seasonal roses', imageUrl: null, measurementId: null, measurementName: 'COUNT' },
    { id: -382, name: 'Marigold garland', description: 'Fresh ceremonial garland', imageUrl: null, measurementId: null, measurementName: 'COUNT' },
  ],
  [-232]: [
    { id: -391, name: 'Celebration hamper', description: 'Snacks and keepsakes', imageUrl: null, measurementId: null, measurementName: 'COUNT' },
    { id: -392, name: 'Thank-you box', description: 'A thoughtful little gift', imageUrl: null, measurementId: null, measurementName: 'COUNT' },
  ],
}

function samplePage<T>(items: T[], pageNumber = 0, pageSize = 12): ReferencePage<T> {
  const start = pageNumber * pageSize
  const pageItems = items.slice(start, start + pageSize)
  const totalPages = Math.ceil(items.length / pageSize)
  return {
    items: pageItems,
    pageNumber,
    pageSize,
    totalElements: items.length,
    totalPages,
    lastPage: pageNumber >= Math.max(totalPages - 1, 0),
  }
}

export function getSampleBusinessTypes(keyword = '', pageNumber = 0, pageSize = 12) {
  const query = keyword.trim().toLowerCase()
  const items = query
    ? SAMPLE_BUSINESS_TYPES.filter((item) => item.name.toLowerCase().includes(query))
    : SAMPLE_BUSINESS_TYPES
  return samplePage(items, pageNumber, pageSize)
}

export function getSampleCategories(businessTypeId: number, pageNumber = 0, pageSize = 12) {
  return samplePage(
    SAMPLE_CATEGORIES.filter((item) => item.businessTypeId === businessTypeId),
    pageNumber,
    pageSize,
  )
}

export function getSampleProducts(categoryId: number, pageNumber = 0, pageSize = 12) {
  return samplePage(SAMPLE_PRODUCTS_BY_CATEGORY[categoryId] ?? [], pageNumber, pageSize)
}
