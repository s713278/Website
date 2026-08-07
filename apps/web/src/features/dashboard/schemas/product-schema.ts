import { z } from 'zod';

export const productFormSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  category: z.string().trim().min(1, 'Category is required').max(40),
  price: z.coerce.number().min(1, 'Price must be at least ₹1').max(1_000_000),
  stock: z.coerce.number().int().min(0, 'Stock cannot be negative').max(100_000),
  status: z.enum(['active', 'draft', 'archived']),
  sku: z.string().trim().max(40).optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const settingsFormSchema = z.object({
  storeName: z.string().trim().min(2, 'Store name is required').max(80),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'Enter a 10-digit WhatsApp number'),
  location: z.string().trim().min(2, 'Location is required').max(80),
  themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a hex color like #10b981'),
});

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
