import { useState } from 'react'
import { cn } from '@/lib/utils'

type CategoryIconProps = {
  imagePath?: string
  label: string
  className?: string
}

function categoryInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function CategoryIcon({ imagePath, label, className }: CategoryIconProps) {
  const [failed, setFailed] = useState(false)

  if (!imagePath || failed) {
    return (
      <span
        className={cn(
          'flex size-full items-center justify-center bg-transparent',
          className,
        )}
        aria-hidden
      >
        <span className="select-none text-[13px] font-semibold tracking-wide text-slate-800 sm:text-sm">
          {categoryInitials(label)}
        </span>
      </span>
    )
  }

  return (
    <img
      src={imagePath}
      alt=""
      title={label}
      loading="lazy"
      decoding="async"
      className={cn('size-full object-cover', className)}
      onError={() => setFailed(true)}
    />
  )
}
