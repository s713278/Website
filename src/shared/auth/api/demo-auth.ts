import type { User, UserRole } from '@/shared/types'

export type LoginInput = {
  email: string
  password: string
}

export type RegisterInput = LoginInput & {
  name: string
  role: UserRole
}

export type AuthSession = {
  user: User
  token: string
  refreshToken?: string | null
}

const DEMO_USERS: Array<User & { password: string }> = [
  {
    id: 'u-customer',
    name: 'Riya Customer',
    email: 'customer@demo.com',
    password: 'demo1234',
    role: 'customer',
  },
  {
    id: 'u-vendor',
    name: 'Vikram Vendor',
    email: 'vendor@demo.com',
    password: 'demo1234',
    role: 'vendor',
    vendorId: 'r1',
  },
]

function delay(ms = 350) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function demoLogin(input: LoginInput): Promise<AuthSession> {
  await delay()
  const found = DEMO_USERS.find(
    (user) =>
      user.email.toLowerCase() === input.email.trim().toLowerCase() &&
      user.password === input.password,
  )
  if (!found) throw new Error('Invalid email or password')
  return {
    user: {
      id: found.id,
      name: found.name,
      email: found.email,
      role: found.role,
      vendorId: found.vendorId,
    },
    token: `demo-token-${found.id}`,
  }
}

export async function demoRegister(input: RegisterInput): Promise<AuthSession> {
  await delay()
  const exists = DEMO_USERS.some(
    (user) => user.email.toLowerCase() === input.email.trim().toLowerCase(),
  )
  if (exists) throw new Error('An account with this email already exists')
  const user: User = {
    id: `u-${crypto.randomUUID().slice(0, 8)}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    vendorId: input.role === 'vendor' ? `v-${crypto.randomUUID().slice(0, 6)}` : undefined,
  }
  DEMO_USERS.push({ ...user, password: input.password })
  return { user, token: `demo-token-${user.id}` }
}

export const DEMO_CREDENTIALS = DEMO_USERS.map(({ email, password, role }) => ({
  email,
  password,
  role,
}))
