import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

/**
 * Unit tests run against the pure onboarding logic — resume, validation, entry routing
 * and payload mapping. None of it touches the DOM, so the default node environment is
 * enough and no jsdom/testing-library dependency is pulled in.
 *
 * The app config is merged rather than copied so the `@` and `@mithra/api-client`
 * aliases stay defined in one place.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }),
)
