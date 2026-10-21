import { describe, expect, it } from 'vitest'
import { STAGE_QUERY, planBarVisible, resolveStageMode } from './pricing-scroll'

describe('resolveStageMode', () => {
  it('is static whenever the stage query fails', () => {
    expect(resolveStageMode({ stageQuery: false, desktop: true })).toBe('static')
  })

  it('is tablet or desktop when the stage query matches', () => {
    expect(resolveStageMode({ stageQuery: true, desktop: false })).toBe('tablet')
    expect(resolveStageMode({ stageQuery: true, desktop: true })).toBe('desktop')
  })

  it('pins the stage query and the 680 px floor', () => {
    expect(STAGE_QUERY).toBe('(min-width: 768px) and (min-height: 680px) and (prefers-reduced-motion: no-preference)')
  })
})

describe('planBarVisible', () => {
  it('hides the bar while the plan card is on screen', () => {
    expect(planBarVisible({ planCardBottom: 200, footnoteTop: 3000, viewportHeight: 844 })).toBe(false)
  })

  it('shows the bar once the plan card has scrolled above the viewport', () => {
    expect(planBarVisible({ planCardBottom: -1, footnoteTop: 2000, viewportHeight: 844 })).toBe(true)
  })

  it('hides the bar once the footnote enters', () => {
    expect(planBarVisible({ planCardBottom: -900, footnoteTop: 800, viewportHeight: 844 })).toBe(false)
  })

  it('hides the bar above the section', () => {
    expect(planBarVisible({ planCardBottom: 1500, footnoteTop: 4000, viewportHeight: 844 })).toBe(false)
  })
})
