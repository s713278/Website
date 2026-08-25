import { cn } from '@/lib/utils'

type CategoryIconProps = {
  imagePath?: string
  label: string
  className?: string
}
export function CategoryIcon({ imagePath, label, className }: CategoryIconProps) {
  if (!imagePath) {
    return (
      <span
        className={cn(
          'flex size-full items-center justify-center text-sm font-bold text-slate-500',
          className,
        )}
        aria-hidden
      >
        {label.charAt(0).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={imagePath}
      alt=""
      loading="lazy"
      className={cn('size-full object-cover', className)}
    />
  )
}
