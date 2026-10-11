/**
 * Export onboarding catalog to CSV files for database import.
 * Run: npx --yes tsx scripts/export-onboarding-catalog-csv.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ONBOARDING_CATALOG } from '../src/shared/data/onboarding-catalog.ts'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shared', 'data')

function csvCell(value: string | number): string {
  const s = String(value)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function csvTable(headers: string[], rows: Array<Array<string | number>>): string {
  return [headers.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n') + '\n'
}

const businessRows: Array<Array<string | number>> = []
const categoryRows: Array<Array<string | number>> = []
const productRows: Array<Array<string | number>> = []
const flatRows: Array<Array<string | number>> = []

let businessId = 0
let categoryId = 100
let productId = 1000

for (const biz of ONBOARDING_CATALOG) {
  businessId += 1
  businessRows.push([
    businessId,
    biz.id,
    biz.label,
    biz.icon,
    biz.iconImage,
    biz.keywords,
    businessId,
  ])

  biz.categories.forEach((cat, catIndex) => {
    categoryId += 1
    const categoryCode = `${biz.id}__${cat.id}`
    categoryRows.push([
      categoryId,
      cat.id,
      categoryCode,
      cat.name,
      businessId,
      biz.id,
      cat.icon,
      cat.iconImage,
      cat.image,
      catIndex + 1,
    ])

    cat.products.forEach((prod, prodIndex) => {
      productId += 1
      productRows.push([
        productId,
        prod.id,
        prod.name,
        categoryId,
        cat.id,
        categoryCode,
        businessId,
        biz.id,
        prod.icon,
        prod.iconImage,
        prodIndex + 1,
      ])
      flatRows.push([
        businessId,
        biz.id,
        biz.label,
        biz.icon,
        biz.iconImage,
        categoryId,
        cat.id,
        categoryCode,
        cat.name,
        cat.icon,
        cat.iconImage,
        cat.image,
        productId,
        prod.id,
        prod.name,
        prod.icon,
        prod.iconImage,
      ])
    })
  })
}

mkdirSync(outDir, { recursive: true })

writeFileSync(
  join(outDir, 'onboarding-catalog-business-types.csv'),
  csvTable(
    ['id', 'code', 'name', 'icon', 'icon_image', 'keywords', 'sort_order'],
    businessRows,
  ),
  'utf8',
)

writeFileSync(
  join(outDir, 'onboarding-catalog-categories.csv'),
  csvTable(
    [
      'id',
      'code',
      'unique_code',
      'name',
      'business_type_id',
      'business_type_code',
      'icon',
      'icon_image',
      'image_path',
      'sort_order',
    ],
    categoryRows,
  ),
  'utf8',
)

writeFileSync(
  join(outDir, 'onboarding-catalog-products.csv'),
  csvTable(
    [
      'id',
      'code',
      'name',
      'category_id',
      'category_code',
      'category_unique_code',
      'business_type_id',
      'business_type_code',
      'icon',
      'icon_image',
      'sort_order',
    ],
    productRows,
  ),
  'utf8',
)

writeFileSync(
  join(outDir, 'onboarding-catalog.csv'),
  csvTable(
    [
      'business_type_id',
      'business_type_code',
      'business_type_name',
      'business_type_icon',
      'business_type_icon_image',
      'category_id',
      'category_code',
      'category_unique_code',
      'category_name',
      'category_icon',
      'category_icon_image',
      'category_image_path',
      'product_id',
      'product_code',
      'product_name',
      'product_icon',
      'product_icon_image',
    ],
    flatRows,
  ),
  'utf8',
)

console.log(
  `Wrote ${businessRows.length} business types, ${categoryRows.length} categories, ${productRows.length} products`,
)
