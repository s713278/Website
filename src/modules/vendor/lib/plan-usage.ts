/** Presents one plan allowance without collapsing a real zero into missing data. */
export function formatPlanUsage(usage: number | null, limit: number | null): string {
  if (usage === null || limit === null) return 'Not available'
  return `${usage} of ${limit} used`
}
