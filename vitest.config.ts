import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

/**
 * Two tiers share one runner and one `npm run test`.
 *
 * Node stays the default environment: most suites cover pure logic — onboarding resume,
 * validation, entry routing, payload mapping — and never touch the DOM. Component tests
 * opt into jsdom per file with a `// @vitest-environment jsdom` docblock, so the pure
 * suites are not slowed by a DOM they do not use and the environment each file needs is
 * visible in the file itself.
 *
 * The app config is merged rather than copied so the `@` and `@mithra/api-client`
 * aliases stay defined in one place.
 *
 * Workers are capped because the default (one per core) saturates the CPU and pushes jsdom
 * queries past their timeouts; see docs/TESTING.md.
 *
 * Node 25+ ships a built-in `localStorage` global that shadows jsdom's and breaks suites that
 * use storage; the workers run with it turned off where the running Node knows the flag.
 */
const webstorageOff = process.allowedNodeEnvironmentFlags.has('--no-experimental-webstorage')
  ? ['--no-experimental-webstorage']
  : []

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}'],
      maxWorkers: 6,
      poolOptions: { forks: { execArgv: webstorageOff } },
    },
  }),
)
