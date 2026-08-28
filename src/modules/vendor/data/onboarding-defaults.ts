import {
  ONBOARDING_DRAFT_VERSION,
  type OnboardingRuntimeState,
  type VendorOnboardingDraftV1,
} from '../types/onboarding'

export function createEmptyRuntimeState(): OnboardingRuntimeState {
  return {
    phone: '',
    otpDigits: ['', '', '', ''],
    orderWhatsapp: '',
    supportWhatsapp: '',
    paymentDetails: {
      upiId: '',
      upiAccountHolderName: '',
      bankAccountHolderName: '',
      bankAccountNumber: '',
      bankIfscCode: '',
      bankName: '',
    },
    logoFile: null,
    logoUrl: null,
    bannerFile: null,
    bannerUrl: null,
  }
}

export function createEmptyOnboardingDraft(): VendorOnboardingDraftV1 {
  return {
    version: ONBOARDING_DRAFT_VERSION,
    currentStep: 1,
    completedSteps: [],
    catalogSource: 'account',
    maskedPhone: null,
    mobileVerified: false,
    business: {
      businessType: null,
      businessName: '',
      ownerName: '',
      contactPerson: '',
    },
    categories: [],
    products: [],
    skus: [],
    delivery: {
      fulfillmentType: 'HOME_DELIVERY',
      orderAcceptancePolicy: 'AUTO_ACCEPT',
      schedulingStrategy: 'FIXED_WINDOW',
      fixedWindow: { minDeliveryDays: 1, maxDeliveryDays: 3 },
      customerSelectDate: {
        minAdvanceBookingDays: 1,
        maxAdvanceBookingDays: 14,
        cutoffTime: '18:00',
      },
      predefinedDays: { days: [], maxOrdersPerDay: 25 },
      instant: {
        minPrepTimeMinutes: 30,
        maxPrepTimeMinutes: 60,
        operatingUntil: '22:00',
        orderCutoffTime: '21:00',
      },
      shippingStrategy: 'FLAT',
      shipping: { charge: 30, freeDeliveryThreshold: 300 },
      slots: [],
      consentTitle: '',
      consentText: '',
    },
    payments: [
      { type: 'PRE_PAID', enabled: false, isDefault: false },
      { type: 'ONLINE', enabled: false, isDefault: false },
      { type: 'CASH_ON_DELIVERY', enabled: false, isDefault: false },
    ],
    storefront: {
      storeName: '',
      tagline: '',
      businessLocation: '',
      instagram: '',
      primaryColor: '#10b981',
      accentColor: '#65a30d',
      backgroundColor: '#f0fdf4',
      textColor: '#111827',
      fontFamily: 'Outfit',
      themePreset: 'FRESH',
      buttonShape: 'ROUNDED',
      cardStyle: 'BORDER',
      welcomeMessage: '',
      announcementBar: '',
      heroBadges: ['Local business', 'Order direct'],
      trustStrip: [
        { id: 'safe', icon: 'shield', title: 'Hygienic & safe', subtitle: 'Prepared with care', enabled: true },
        { id: 'local', icon: 'map-pin', title: 'Local business', subtitle: 'Made nearby', enabled: true },
        { id: 'direct', icon: 'message-circle', title: 'Order direct', subtitle: 'Chat on WhatsApp', enabled: false },
      ],
    },
    publication: { state: 'draft', draftSlug: null, completedAt: null },
  }
}
