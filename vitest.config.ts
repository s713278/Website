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
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }),
)
