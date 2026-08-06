import { z } from 'zod';

const envSchema = z.object({
  VITE_APP_NAME: z.string().default('MithraDirect'),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  VITE_API_BASE_URL: z.string().url().or(z.string().min(1)),
  VITE_USE_API: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  VITE_MARKETING_URL: z.string().optional(),
  VITE_STOREFRONT_URL: z.string().optional(),
  VITE_VENDOR_APP_URL: z.string().optional(),
  VITE_ENABLE_QUERY_DEVTOOLS: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),
});

export type AppEnv = z.infer<typeof envSchema> & {
  isDev: boolean;
  useApi: boolean;
};

function readEnv(): AppEnv {
  const parsed = envSchema.safeParse({
    VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    VITE_API_BASE_URL:
      import.meta.env.VITE_API_BASE_URL || 'https://subscriptionapp-wgf8.onrender.com/api',
    VITE_USE_API: import.meta.env.VITE_USE_API,
    VITE_MARKETING_URL: import.meta.env.VITE_MARKETING_URL,
    VITE_STOREFRONT_URL: import.meta.env.VITE_STOREFRONT_URL,
    VITE_VENDOR_APP_URL: import.meta.env.VITE_VENDOR_APP_URL,
    VITE_ENABLE_QUERY_DEVTOOLS: import.meta.env.VITE_ENABLE_QUERY_DEVTOOLS,
  });

  if (!parsed.success) {
    console.error(parsed.error.flatten());
    throw new Error('Invalid environment configuration');
  }

  const data = parsed.data;
  return {
    ...data,
    isDev: data.VITE_APP_ENV !== 'production',
    useApi: Boolean(data.VITE_USE_API),
  };
}

export const env = readEnv();
