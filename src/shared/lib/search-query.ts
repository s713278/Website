/** Shared URL search-query helpers — reuse across storefront, vendor, etc. */

export function readSearchQuery(search: string): string {
  return new URLSearchParams(search).get('q')?.trim() ?? ''
}


export function matchesSearchQuery(text: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return text.toLowerCase().includes(q)
}
