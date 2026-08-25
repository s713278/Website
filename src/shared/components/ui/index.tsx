import { useId, type ComponentProps, type ReactNode } from 'react'
import { Loader2Icon } from 'lucide-react'
import { Badge as ShadBadge } from '@/components/ui/badge'
import { Button as ShadButton } from '@/components/ui/button'
import { Card as ShadCard } from '@/components/ui/card'
import { Input as ShadInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'link'
type AppButtonSize = 'sm' | 'md' | 'lg'

const buttonVariantMap = {
  primary: 'default',
  secondary: 'secondary',
  ghost: 'ghost',
  danger: 'destructive',
  outline: 'outline',
  link: 'link',
} as const

const buttonSizeMap = {
  sm: 'sm',
  md: 'default',
  lg: 'lg',
} as const

type ButtonProps = Omit<ComponentProps<typeof ShadButton>, 'variant' | 'size'> & {
  variant?: AppButtonVariant
  size?: AppButtonSize
  fullWidth?: boolean
}

/** App-facing Button on top of shadcn/ui */
export function Button({
  className,
  variant = 'primary',
  size = 'md',
  fullWidth,
  ...props
}: ButtonProps) {
  return (
    <ShadButton
      variant={buttonVariantMap[variant]}
      size={buttonSizeMap[size]}
      className={cn(fullWidth && 'w-full', className)}
      {...props}
    />
  )
}

type AppBadgeTone = 'neutral' | 'success' | 'warning' | 'danger'

const badgeToneMap = {
  neutral: 'secondary',
  success: 'success',
  warning: 'warning',
  danger: 'destructive',
} as const

type BadgeProps = Omit<ComponentProps<typeof ShadBadge>, 'variant'> & {
  tone?: AppBadgeTone
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return <ShadBadge variant={badgeToneMap[tone]} className={className} {...props} />
}

type CardProps = ComponentProps<typeof ShadCard>

export function Card({ className, ...props }: CardProps) {
  return <ShadCard className={cn('gap-0 p-4 shadow-sm', className)} {...props} />
}

type InputProps = ComponentProps<typeof ShadInput> & {
  label?: string
  error?: string
}

export function Input({ className, label, error, id, 'aria-describedby': describedBy, ...props }: InputProps) {
  const generatedId = useId()
  const inputId = id ?? props.name ?? generatedId
  const errorId = error ? `${inputId}-error` : undefined
  const descriptionIds = [describedBy, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className="grid w-full gap-1.5">
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      <ShadInput
        {...props}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={descriptionIds}
        className={className}
      />
      {error ? <p id={errorId} className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 border-dashed px-6 py-16 text-center shadow-none">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </Card>
  )
}

type PageHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
      <Loader2Icon className="size-5 animate-spin text-primary" />
      {label}
    </div>
  )
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-24 w-full', className)} />
}
