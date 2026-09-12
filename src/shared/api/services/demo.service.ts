import {
  DEMO_STORE_STATE_KEYS,
  armDemoFailure,
  demoStoreStateKey,
  resetDemoState,
  setDemoStoreState,
  storeStateFieldsFor,
  storeStateResumeStepFor,
  type DemoStoreStateKey,
  type DemoStoreStateOverride,
} from '../fixtures/demo-state'
import { isLiveApi } from '../mode'

/**
 * The demo-mode controls the vendor console exposes to itself.
 *
 * This exists so no component has to import `../fixtures/demo-state` directly. Components
 * import API behaviour from `@/shared/api`, and the demo/live branch stays inside the
 * service layer — which is the boundary that stopped holding last time, when demo data
 * drifted into a shape live never sent and nothing caught it.
 *
 * Every function here is inert under a live API. `storeStateKeys` is still readable so a
 * caller can render a control and disable it, rather than branching on mode itself.
 */
export const demoService = {
  /** Whether demo controls should be offered at all. */
  isDemo: () => !isLiveApi(),

  /** The five states `deriveStoreState` can produce, in display order. */
  storeStateKeys: DEMO_STORE_STATE_KEYS,

  /** The currently selected demo store state. */
  storeStateKey: (): DemoStoreStateKey => demoStoreStateKey(),

  /**
   * The two context fields a state derives from.
   *
   * The switcher writes these and lets `deriveStoreState` run, rather than setting a
   * `StoreState` outright. Setting the outcome would let the switcher display a combination
   * the real derivation could never produce, and the state screens would then be verified
   * against something the backend cannot send.
   */
  storeStateFields: (key: DemoStoreStateKey): DemoStoreStateOverride => storeStateFieldsFor(key),

  /** A presentation-only resume step for the synthetic setting-up scenario. */
  storeStateResumeStep: (key: DemoStoreStateKey): number | null => storeStateResumeStepFor(key),

  select: (key: DemoStoreStateKey) => {
    if (isLiveApi()) return
    setDemoStoreState(key)
  },

  /** Arm a one-shot read failure, so recovery behaviour is demonstrable. */
  failNextRead: () => {
    if (isLiveApi()) return
    armDemoFailure()
  },

  /** Back to the seeded state. Also happens on reload, since demo state is memory-only. */
  reset: () => {
    if (isLiveApi()) return
    resetDemoState()
  },
}

export type { DemoStoreStateKey }
