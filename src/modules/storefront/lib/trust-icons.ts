import { Leaf, Lock, ShieldCheck, Truck } from 'lucide-react'

const TRUST_ICONS = {
  shield: ShieldCheck,
  leaf: Leaf,
  truck: Truck,
  lock: Lock,
} as const

/**  lucide icon (store home + PDP). */
export function resolveTrustIcon(name: string) {
  return TRUST_ICONS[name.toLowerCase() as keyof typeof TRUST_ICONS] ?? ShieldCheck
}
