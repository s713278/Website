import type { StorefrontDraft, StorefrontThemePreset } from '../types/onboarding'

export type OnboardingThemePreset = {
  id: StorefrontThemePreset
  label: string
  description: string
  primaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
  fontFamily: string
}

export const ONBOARDING_THEME_PRESETS: readonly OnboardingThemePreset[] = [
  {
    id: 'WARM',
    label: 'Warm',
    description: 'Amber, orange and warm sand',
    primaryColor: '#d97706',
    accentColor: '#f97316',
    backgroundColor: '#faf6f1',
    textColor: '#111827',
    fontFamily: 'Poppins',
  },
  {
    id: 'FRESH',
    label: 'Fresh',
    description: 'Emerald, lime and soft mint',
    primaryColor: '#10b981',
    accentColor: '#65a30d',
    backgroundColor: '#f0fdf4',
    textColor: '#111827',
    fontFamily: 'Outfit',
  },
  {
    id: 'MINIMAL',
    label: 'Minimal',
    description: 'Teal, sky and soft gray',
    primaryColor: '#0d9488',
    accentColor: '#0ea5e9',
    backgroundColor: '#f9fafb',
    textColor: '#111827',
    fontFamily: 'Inter',
  },
  {
    id: 'BOLD',
    label: 'Bold',
    description: 'Rose, violet and crisp white',
    primaryColor: '#e11d48',
    accentColor: '#7c3aed',
    backgroundColor: '#ffffff',
    textColor: '#111827',
    fontFamily: 'Poppins',
  },
] as const

export function storefrontPatchForPreset(
  preset: OnboardingThemePreset,
): Pick<
  StorefrontDraft,
  | 'themePreset'
  | 'primaryColor'
  | 'accentColor'
  | 'backgroundColor'
  | 'textColor'
  | 'fontFamily'
> {
  return {
    themePreset: preset.id,
    primaryColor: preset.primaryColor,
    accentColor: preset.accentColor,
    backgroundColor: preset.backgroundColor,
    textColor: preset.textColor,
    fontFamily: preset.fontFamily,
  }
}
