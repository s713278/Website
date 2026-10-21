/** The deck needs room for the pinned cards and no reduced-motion preference. */
export const STAGE_QUERY = '(min-width: 768px) and (min-height: 680px) and (prefers-reduced-motion: no-preference)'

/** Selects desktop over tablet inside stage mode. */
export const DESKTOP_QUERY = '(min-width: 1024px)'

export type StageMode = 'static' | 'tablet' | 'desktop'

export function resolveStageMode(input: { stageQuery: boolean; desktop: boolean }): StageMode {
  if (!input.stageQuery) return 'static'
  return input.desktop ? 'desktop' : 'tablet'
}

/** The bar shows once the plan card is above the viewport and until the footnote enters it. */
export function planBarVisible(input: { planCardBottom: number; footnoteTop: number; viewportHeight: number }): boolean {
  return input.planCardBottom <= 0 && input.footnoteTop > input.viewportHeight
}
