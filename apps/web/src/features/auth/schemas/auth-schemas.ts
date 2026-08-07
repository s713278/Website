import { z } from 'zod';

export const otpRequestSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number'),
  role: z.enum(['customer', 'vendor', 'admin']),
});

export const otpVerifySchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'Enter a valid 10-digit mobile number'),
  otp: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Enter the 4-digit OTP'),
});

export type OtpRequestValues = z.infer<typeof otpRequestSchema>;
export type OtpVerifyValues = z.infer<typeof otpVerifySchema>;
