import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ProductImage } from '@/modules/storefront/components/ProductImage'

type ProductGalleryProps = {
  images: string[]
  alt: string
  className?: string
  corner?: ReactNode
}

/** Compact product gallery — main image + optional thumbnails. */
export function ProductGallery({ images, alt, className, corner }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = images[activeIndex] ?? images[0]

  if (!active) {
    return (
      <div className={cn('relative mx-auto w-full max-w-[280px] sm:max-w-[300px]', className)}>
        <ProductImage alt={alt} className="aspect-[4/3] w-full rounded-xl" />
        {corner}
      </div>
    )
  }

  return (
    <div className={cn('mx-auto w-full max-w-[300px] lg:mx-0', className)}>
      <div className="relative">
        <ProductImage
          src={active}
          alt={alt}
          className="aspect-[4/3] w-full rounded-xl border border-slate-100 shadow-sm"
        />
        {corner}
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
              <ProductImage src={image} alt="" className="size-full" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
