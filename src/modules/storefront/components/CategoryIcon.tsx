import { useState } from 'react'
import { cn } from '@/lib/utils'

type CategoryIconProps = {
  icon?: string
  label: string
  className?: string
}

function categoryInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function CategoryIcon({ icon, label, className }: CategoryIconProps) {
  const [failed, setFailed] = useState(false)

  if (!icon || failed) {
    return (
      <span
        className={cn(
          'flex size-full items-center justify-center bg-transparent',
          className,
        )}
        aria-hidden
      >
        <span className="select-none text-[12px] font-medium tracking-wide text-slate-700 sm:text-[13px]">
          {categoryInitials(label)}
        </span>
      </span>
    )
  }

  return (
    <img
      src={icon}
      alt=""
      title={label}
      loading="lazy"
      decoding="async"
      className={cn('size-[68%] object-contain', className)}
      onError={() => setFailed(true)}
    />
  )
}
