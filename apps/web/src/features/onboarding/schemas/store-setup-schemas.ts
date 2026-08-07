import { z } from 'zod';

export const phoneStepSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number'),
});

export const otpStepSchema = z.object({
  otp: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Enter the 4-digit OTP'),
});

export const businessStepSchema = z.object({
  businessType: z.string().min(1, 'Please select a business type.'),
});

export const categoriesStepSchema = z.object({
  categoryIds: z
    .array(z.union([z.string(), z.number()]))
    .min(1, 'Select at least one category.')
    .max(2, 'Maximum 2 categories.'),
});

export const productsStepSchema = z.object({
  products: z
    .array(
      z.object({
        categoryId: z.union([z.string(), z.number()]),
        name: z.string().trim().min(1),
      }),
    )
    .min(1, 'Add at least one product in your selected categories.'),
});

export const pricesStepSchema = z.object({
  hasPricedSku: z.literal(true, {
    errorMap: () => ({ message: 'Set at least one size and price.' }),
  }),
});

export const deliveryStepSchema = z
  .object({
    storePickup: z.boolean(),
    homeDelivery: z.boolean(),
    homeCharge: z.coerce.number().min(0),
    courierDelivery: z.boolean(),
    courierCharge: z.coerce.number().min(0),
  })
  .superRefine((v, ctx) => {
    if (!v.storePickup && !v.homeDelivery && !v.courierDelivery) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one delivery method.',
        path: ['storePickup'],
      });
    }
  });

export const paymentsStepSchema = z
  .object({
    upiEnabled: z.boolean(),
    upiId: z.string().trim(),
    payeeName: z.string().trim(),
    bankEnabled: z.boolean(),
    accountName: z.string().trim(),
    accountNumber: z.string().trim(),
    ifsc: z.string().trim(),
    bankName: z.string().trim(),
    codEnabled: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (!v.upiEnabled && !v.bankEnabled && !v.codEnabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one payment method.',
        path: ['upiEnabled'],
      });
    }
    if (v.upiEnabled && !v.upiId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter your UPI ID.',
        path: ['upiId'],
      });
    }
  });

export const settingsStepSchema = z.object({
  storeName: z.string().trim().min(2, 'Enter a store name.'),
  tagline: z.string().trim().max(120).optional().or(z.literal('')),
  location: z.string().trim().max(120).optional().or(z.literal('')),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'Enter a valid WhatsApp number.'),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a valid theme color.'),
  logoDataUrl: z.string().optional().or(z.literal('')),
  bannerDataUrl: z.string().optional().or(z.literal('')),
});

export type PhoneStepValues = z.infer<typeof phoneStepSchema>;
export type OtpStepValues = z.infer<typeof otpStepSchema>;
export type DeliveryStepValues = z.infer<typeof deliveryStepSchema>;
export type PaymentsStepValues = z.infer<typeof paymentsStepSchema>;
export type SettingsStepValues = z.infer<typeof settingsStepSchema>;
