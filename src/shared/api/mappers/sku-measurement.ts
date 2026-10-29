/** Normalize current SKU measurements and older responses used by demo fixtures. */
export function mapSkuMeasurement(row: Record<string, unknown>): {
  quantity: number | null
  unit: string
  size: string
} {
  if (row.quantity_value != null || row.unit != null) {
    const value = row.quantity_value
    const quantity = typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() ? Number(value) : NaN
    const unit = typeof row.unit === 'string' ? row.unit.trim() : ''
    return {
      quantity: Number.isFinite(quantity) ? quantity : null,
      unit,
      size: Number.isFinite(quantity) ? `${quantity} ${unit}`.trim() : unit,
    }
  }

  const size = typeof row.sku_size === 'string' ? row.sku_size.trim() : ''
  const match = size.match(/^([\d.]+)\s*(.*)$/)
  const quantity = match ? Number(match[1]) : NaN
  return {
    quantity: Number.isFinite(quantity) ? quantity : null,
    unit: match ? match[2].trim() : size,
    size,
  }
}
