import { useState } from 'react'
import { cn } from '@/lib/utils'

type ProductGalleryProps = {
  images: string[]
  alt: string
  className?: string
}

/** Compact product gallery — main image + optional thumbnails. */
export function ProductGallery({ images, alt, className }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = images[activeIndex] ?? images[0]

  if (!active) {
    return (
      <div
        className={cn(
          'mx-auto flex aspect-[4/3] w-full max-w-[280px] items-center justify-center rounded-xl bg-slate-100 text-4xl sm:max-w-[300px]',
          className,
        )}
      >
        🥒
      </div>
    )
  }

  return (
    <div className={cn('mx-auto w-full max-w-[300px] lg:mx-0', className)}>
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <img src={active} alt={alt} className="aspect-[4/3] w-full object-cover" />
      </div>

      {images.length > 1 ? (
        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                'size-14 shrink-0 overflow-hidden rounded-lg border-2 transition sm:size-16',
                index === activeIndex
                  ? 'border-[var(--store-theme,var(--md-green-600))]'
                  : 'border-transparent hover:border-slate-200',
              )}
              aria-label={`View image ${index + 1}`}
              aria-pressed={index === activeIndex}
            >
              <img src={image} alt="" className="size-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
