export type UserRole = 'customer' | 'vendor'

export type User = {
  id: string
  name: string
  email: string
  phone?: string
  role: UserRole
  vendorId?: string
}
