const tails = new Map<string, Promise<unknown>>()

/** Run vendor cart HTTP one-at-a-time so stale snapshots cannot wipe later adds. */
export function enqueueVendorCart<T>(vendorId: string, task: () => Promise<T>): Promise<T> {
  const previous = tails.get(vendorId) ?? Promise.resolve()
  const next = previous.then(task, task)
  tails.set(
    vendorId,
    next.then(
      () => undefined,
      () => undefined,
    ),
  )
  return next
}

export function resetVendorCartQueue() {
  tails.clear()
}
